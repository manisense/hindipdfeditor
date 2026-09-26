import { ArrowRight, BookOpen, FileText, GraduationCap, Landmark, Scale } from 'lucide-react';

import { TOOL_VISUALS } from '../components/toolVisuals';
import { cn } from '../lib/cn';
import { useLanguage, useTx } from '../lib/i18n';
import { toolHref, type ToolId } from '../lib/tools';
import { SectionHeading } from './ui/section-heading';

/**
 * "What do you need to do?" — one card per real document job, each linking to the tool that
 * does it. Documents issued by an authority are never edited here; those cards point to the
 * application or affidavit route instead (AGENTS.md website rules).
 */
export function UseCasesSection() {
  const { lang } = useLanguage();
  const tx = useTx();

  const cases: {
    icon: typeof Landmark;
    title: string;
    desc: string;
    toolId: ToolId;
    action: string;
    guide?: { href: string; label: string };
  }[] = [
    {
      icon: Landmark,
      title: tx('Sarkari application forms', 'सरकारी आवेदन फॉर्म'),
      desc: tx(
        'Fill a blank recruitment or certificate form in Unicode Hindi, then shrink it under the portal’s upload limit.',
        'खाली भर्ती या प्रमाण-पत्र फॉर्म यूनिकोड हिंदी में भरें, फिर पोर्टल की साइज सीमा के अंदर छोटा करें।',
      ),
      toolId: 'edit',
      action: tx('Fill the form', 'फॉर्म भरें'),
      guide: { href: '/articles/pdf-size-kam-kaise-kare-100kb-sarkari-form/', label: tx('Read the Hindi guide', 'गाइड पढ़ें') },
    },
    {
      icon: Scale,
      title: tx('Affidavits and stamp papers', 'शपथ पत्र और स्टांप पेपर'),
      desc: tx(
        'Draft a Hindi affidavit, rent agreement or declaration with the margins e-Stamp paper needs.',
        'ई-स्टांप पेपर के मार्जिन के साथ हिंदी शपथ पत्र, किरायानामा या घोषणा पत्र तैयार करें।',
      ),
      toolId: 'edit',
      action: tx('Draft in Hindi', 'हिंदी में लिखें'),
      guide: { href: '/articles/e-stamp-paper-par-hindi-matter-print-margin-guide/', label: tx('Read the Hindi guide', 'गाइड पढ़ें') },
    },
    {
      icon: FileText,
      title: tx('Land record correction requests', 'भूलेख सुधार आवेदन'),
      desc: tx(
        'Fill the correction application for UP Bhulekh or Bihar Parimarjan. The record itself is corrected by the revenue office.',
        'यूपी भूलेख या बिहार परिमार्जन का सुधार आवेदन भरें। रिकॉर्ड में सुधार राजस्व कार्यालय ही करता है।',
      ),
      toolId: 'edit',
      action: tx('Fill the application', 'आवेदन भरें'),
      guide: { href: '/articles/khasra-khatauni-bhulekh-sudhar-hindi-pdf/', label: tx('Read the Hindi guide', 'गाइड पढ़ें') },
    },
    {
      icon: GraduationCap,
      title: tx('Question papers and notes', 'प्रश्न पत्र और नोट्स'),
      desc: tx(
        'Translate a worksheet between Hindi and English, or combine chapters into one file for students.',
        'वर्कशीट का हिंदी-अंग्रेजी अनुवाद करें, या छात्रों के लिए अध्याय एक फाइल में जोड़ें।',
      ),
      toolId: 'translate',
      action: tx('Translate it', 'अनुवाद करें'),
    },
  ];

  return (
    <section id="use-cases" className="bg-cream py-16 sm:py-24" aria-labelledby="use-cases-heading">
      <div className="section-x">
        <SectionHeading
          id="use-cases-heading"
          eyebrow={tx('Start from your document', 'अपने दस्तावेज से शुरू करें')}
          title={tx('What do you need to do?', 'आपको क्या करना है?')}
        />
      </div>

      <ul className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:px-6 lg:mx-auto lg:grid lg:max-w-[1120px] lg:grid-cols-4 lg:overflow-visible">
        {cases.map((item) => {
          const Icon = item.icon;
          const chip = TOOL_VISUALS[item.toolId].chip;
          return (
            <li
              key={item.title}
              className="flex w-[80%] max-w-[320px] shrink-0 snap-start flex-col rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(20,22,31,0.06)] transition-transform duration-200 hover:-translate-y-1 lg:w-auto lg:max-w-none"
            >
              <span className={cn('grid size-12 place-items-center rounded-xl', chip)}>
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-[18px] font-semibold leading-snug text-ink">{item.title}</h3>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">{item.desc}</p>
              <a
                href={toolHref(item.toolId, lang)}
                className="group mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-wash font-display text-[15px] font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
              >
                {item.action}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </a>
              {item.guide ? (
                <a
                  href={item.guide.href}
                  className="mt-3 inline-flex items-center justify-center gap-2 text-[13px] font-medium text-muted hover:text-brand"
                >
                  <BookOpen className="size-4" aria-hidden />
                  {item.guide.label}
                </a>
              ) : (
                <span className="mt-3 h-5" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
