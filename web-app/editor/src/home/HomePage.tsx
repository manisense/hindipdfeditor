import { Nav } from './Nav';
import { Hero } from './Hero';
import { Features } from './Features';
import { HowItWorks } from './HowItWorks';
import { ComparisonSection } from './ComparisonSection';
import { UseCasesSection } from './UseCasesSection';
import { ArticlesSection } from './ArticlesSection';
import { WorkYourWay } from './WorkYourWay';
import { FAQ } from './FAQ';
import { CTA } from './CTA';
import { Footer } from './Footer';
import '../home.css';

/** Marketing home — design from hindipdfeditor landing, wired to our tools. */
export function HomePage() {
  return (
    <div className="home-root">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <ComparisonSection />
        <UseCasesSection />
        <ArticlesSection />
        <WorkYourWay />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}


