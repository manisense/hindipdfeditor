package expo.modules.pdfpageimage

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.Looper
import android.os.Parcel
import android.os.ParcelFileDescriptor
import android.os.RemoteException
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Result of a successful [PdfRenderClient.renderPage]: px sizes of the JPEG, pt sizes of the page. */
internal data class RenderedPage(
  val pxWidth: Int,
  val pxHeight: Int,
  val widthPt: Int,
  val heightPt: Int
)

/**
 * App-process side of [PdfRenderService]: binds to the `:pdfrender` helper process on first
 * use and makes synchronous binder calls to it. If pdfium crashes that process mid-call, the
 * call fails with [PdfRendererCrashedException] instead of taking the app down, and the next
 * call binds a fresh process.
 *
 * Calls block the calling thread until the helper replies, so they must come from a background
 * thread (Expo's AsyncFunction queue), never the main thread: the bind callback itself is
 * delivered on the main thread.
 */
internal class PdfRenderClient(private val context: Context) {
  private val lock = Any()

  // Volatile, not guarded by [lock]: onServiceDisconnected runs on the main thread, and taking
  // [lock] there could block the main thread behind a caller waiting for a bind to finish.
  @Volatile private var binder: IBinder? = null
  private var connection: ServiceConnection? = null

  /** Page count of the PDF behind [pfd]. The caller keeps ownership of [pfd] and closes it. */
  fun pageCount(pfd: ParcelFileDescriptor, uri: String): Int {
    return call(PdfRenderProtocol.TRANSACTION_PAGE_COUNT, uri, { data ->
      data.writeFileDescriptor(pfd.fileDescriptor)
    }) { status, reply ->
      when (status) {
        PdfRenderProtocol.STATUS_OK -> reply.readInt()
        else -> throw PdfOpenFailedException(uri, IllegalStateException(reply.readString()))
      }
    }
  }

  /**
   * Renders one page to [outputFile] as a JPEG. The caller keeps ownership of [pfd].
   *
   * @param pageIndex Zero-based page index.
   * @param scale Requested output px per PDF point (unitless).
   * @param maxPixels Cap on the bitmap's width * height, in px; see [PdfRenderService.render].
   */
  fun renderPage(
    pfd: ParcelFileDescriptor,
    uri: String,
    pageIndex: Int,
    scale: Double,
    maxPixels: Long,
    outputFile: File
  ): RenderedPage {
    return call(PdfRenderProtocol.TRANSACTION_RENDER, uri, { data ->
      data.writeFileDescriptor(pfd.fileDescriptor)
      data.writeInt(pageIndex)
      data.writeDouble(scale)
      data.writeLong(maxPixels)
      data.writeString(outputFile.absolutePath)
    }) { status, reply ->
      when (status) {
        PdfRenderProtocol.STATUS_OK -> RenderedPage(
          pxWidth = reply.readInt(),
          pxHeight = reply.readInt(),
          widthPt = reply.readInt(),
          heightPt = reply.readInt()
        )
        PdfRenderProtocol.STATUS_PAGE_NOT_FOUND ->
          throw PdfPageNotFoundException(pageIndex, reply.readInt())
        PdfRenderProtocol.STATUS_OPEN_FAILED ->
          throw PdfOpenFailedException(uri, IllegalStateException(reply.readString()))
        else -> throw PdfRenderFailedException(uri, pageIndex, reply.readString())
      }
    }
  }

  private fun <T> call(
    code: Int,
    uri: String,
    writeArgs: (Parcel) -> Unit,
    readReply: (Int, Parcel) -> T
  ): T {
    check(Looper.myLooper() != Looper.getMainLooper()) {
      "PdfRenderClient must not be called on the main thread"
    }
    val remote = connect()
    val data = Parcel.obtain()
    val reply = Parcel.obtain()
    try {
      data.writeInterfaceToken(PdfRenderProtocol.DESCRIPTOR)
      writeArgs(data)
      try {
        remote.transact(code, data, reply, 0)
      } catch (e: RemoteException) {
        // DeadObjectException in practice: pdfium crashed the helper process on this file.
        disconnect()
        throw PdfRendererCrashedException(uri, e)
      }
      return readReply(reply.readInt(), reply)
    } finally {
      data.recycle()
      reply.recycle()
    }
  }

  private fun connect(): IBinder {
    synchronized(lock) {
      binder?.let { if (it.isBinderAlive) return it }
      disconnect()

      val latch = CountDownLatch(1)
      var connected: IBinder? = null
      val newConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
          connected = service
          latch.countDown()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
          // The helper process died (usually a pdfium crash). Drop the binder so the next call
          // rebinds; a call in flight already failed with a RemoteException.
          binder = null
        }

        override fun onNullBinding(name: ComponentName?) {
          latch.countDown()
        }
      }
      val intent = Intent(context, PdfRenderService::class.java)
      if (!context.bindService(intent, newConnection, Context.BIND_AUTO_CREATE)) {
        context.unbindService(newConnection)
        throw PdfRendererUnavailableException("bindService returned false")
      }
      connection = newConnection
      if (!latch.await(BIND_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
        disconnect()
        throw PdfRendererUnavailableException("timed out starting the PDF renderer")
      }
      val service = connected ?: run {
        disconnect()
        throw PdfRendererUnavailableException("the PDF renderer returned no binder")
      }
      binder = service
      return service
    }
  }

  private fun disconnect() {
    synchronized(lock) {
      binder = null
      connection?.let {
        try {
          context.unbindService(it)
        } catch (_: IllegalArgumentException) {
          // Already unbound.
        }
      }
      connection = null
    }
  }

  private companion object {
    const val BIND_TIMEOUT_SECONDS = 15L
  }
}
