import { useEffect, useState } from "react";

import { AppStatus } from "../components/AppStatus";
import { ToolShell } from "../components/ToolShell";
import { useLanguage, useTx } from "../lib/i18n";
import { clearSharedFiles, readSharedFiles, SHARED_PARAM, toolsForSharedFiles } from "../lib/sharedFiles";
import { getTool, TOOL_HINDI_NAMES, toolHref } from "../lib/tools";
import "./UtilityTool.css";
import "./SharePage.css";

/**
 * Where a file shared to the installed app lands (`/share/`): it lists the files and the tools
 * that can open them. The chosen tool takes the files from browser storage on load.
 */
export function SharePage() {
  const tx = useTx();
  const { lang, isHindi } = useLanguage();
  const [files, setFiles] = useState<File[] | null>(null);
  const failed = new URLSearchParams(window.location.search).has("error");

  useEffect(() => {
    void readSharedFiles().then(setFiles);
  }, []);

  const tools = files ? toolsForSharedFiles(files) : [];
  const open = (href: string) => `${href}${href.includes("?") ? "&" : "?"}${SHARED_PARAM}=1`;

  return (
    <ToolShell>
      <div className="utility-tool">
        <div className="utility-tool__panel share-page">
          <h1>{tx("What do you want to do?", "आप क्या करना चाहते हैं?")}</h1>
          {files === null ? (
            <p className="utility-tool__note">{tx("Opening the shared file…", "शेयर की गई फाइल खुल रही है…")}</p>
          ) : files.length === 0 ? (
            <AppStatus tone="info" title={tx("No shared file found", "कोई शेयर की गई फाइल नहीं मिली")}>
              {failed
                ? tx("The file could not be received. Open the app once from your home screen, then share the file again.", "फाइल नहीं मिल पाई। ऐप को होम स्क्रीन से एक बार खोलें, फिर फाइल दोबारा शेयर करें।")
                : tx("Shared files are kept for an hour. Share the file again, or choose a tool and open it there.", "शेयर की गई फाइलें एक घंटे तक रखी जाती हैं। फाइल दोबारा शेयर करें, या कोई टूल चुनकर उसमें खोलें।")}{" "}
              <a href={lang === "hi" ? "/hi/" : "/"}>{tx("All tools", "सभी टूल")}</a>
            </AppStatus>
          ) : (
            <>
              <ul className="share-page__files">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    {file.name} <span>{Math.max(1, Math.round(file.size / 1024))} KB</span>
                  </li>
                ))}
              </ul>
              {tools.length === 0 ? (
                <AppStatus tone="warning" title={tx("No tool opens these files together", "कोई टूल इन फाइलों को एक साथ नहीं खोलता")}>
                  {tx("Share PDFs, images (JPG, PNG, WebP) or one Word .docx file, one kind at a time.", "पीडीएफ, फोटो (JPG, PNG, WebP) या एक वर्ड .docx फाइल शेयर करें, एक बार में एक तरह की।")}
                </AppStatus>
              ) : (
                <nav className="share-page__tools" aria-label={tx("Tools for this file", "इस फाइल के टूल")}>
                  {tools.map((id) => {
                    const tool = getTool(id)!;
                    return (
                      <a key={id} className="share-page__tool" href={open(toolHref(id, lang))} style={{ ["--tool-accent" as string]: tool.accent }}>
                        <strong>{isHindi ? TOOL_HINDI_NAMES[id] : tool.shortTitle}</strong>
                      </a>
                    );
                  })}
                </nav>
              )}
              <button
                type="button"
                className="utility-tool__link"
                onClick={() => {
                  void clearSharedFiles();
                  setFiles([]);
                }}
              >
                {tx("Discard the shared file", "शेयर की गई फाइल हटाएं")}
              </button>
            </>
          )}
          <p className="utility-tool__note">
            {tx("The file stays on this device and is deleted once a tool opens it, or after an hour.", "फाइल इसी डिवाइस पर रहती है और किसी टूल के खोलते ही, या एक घंटे बाद, हट जाती है।")}
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
