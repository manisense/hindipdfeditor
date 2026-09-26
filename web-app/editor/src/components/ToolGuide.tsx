import { useLanguage } from '../lib/i18n';
import { TOOL_COPY } from '../lib/toolContent';
import { TOOLS, toolHref, type ToolId } from '../lib/tools';
import { TOOL_VISUALS } from './toolVisuals';
import './ToolGuide.css';

type Props = {
  toolId: ToolId;
};

/** Page heading and intro shown above a tool's workspace. */
export function ToolIntro({ toolId }: Props) {
  const { lang } = useLanguage();
  const copy = TOOL_COPY[toolId][lang];
  return (
    <header className="tool-guide-intro">
      <h1>{copy.heading}</h1>
      <p>{copy.intro}</p>
    </header>
  );
}

/** How-to steps, FAQs and links to the other tools, shown below a tool's workspace. */
export function ToolGuide({ toolId }: Props) {
  const { lang, isHindi } = useLanguage();
  const copy = TOOL_COPY[toolId][lang];
  return (
    <section className="tool-guide" aria-labelledby={`tool-guide-${toolId}`}>
      <div className="tool-guide__card tool-guide__card--steps">
        <h2 id={`tool-guide-${toolId}`}>{isHindi ? 'कैसे इस्तेमाल करें' : 'How to use it'}</h2>
        <ol className="tool-guide__steps">
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="tool-guide__card">
        <h2>{isHindi ? 'अक्सर पूछे जाने वाले सवाल' : 'Questions'}</h2>
        <dl className="tool-guide__faqs">
          {copy.faqs.map((faq) => (
            <div key={faq.q}>
              <dt>{faq.q}</dt>
              <dd>{faq.a}</dd>
            </div>
          ))}
        </dl>
      </div>
      <nav className="tool-guide__related" aria-label={isHindi ? 'दूसरे टूल' : 'Other tools'}>
        <h2>{isHindi ? 'दूसरे पीडीएफ टूल' : 'Other PDF tools'}</h2>
        <ul>
          {TOOLS.filter((tool) => tool.id !== toolId).map((tool) => {
            const { icon: Icon, chip } = TOOL_VISUALS[tool.id];
            return (
              <li key={tool.id}>
                <a href={toolHref(tool.id, lang)}>
                  <span className={`tool-guide__chip ${chip}`}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  {TOOL_COPY[tool.id][lang].heading}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </section>
  );
}
