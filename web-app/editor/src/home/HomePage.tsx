import { SiteHeader } from '../components/SiteHeader';
import { ArticlesSection } from './ArticlesSection';
import { CTA } from './CTA';
import { FAQ } from './FAQ';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { UseCasesSection } from './UseCasesSection';
import { WhyHindiSection } from './WhyHindiSection';
import '../home.css';

/**
 * Marketing home: pick-and-play hero, then one job per section — document jobs, why Hindi
 * stays joined, how it works, guides, FAQ, closing CTA.
 */
export function HomePage() {
  return (
    <div className="home-root">
      <SiteHeader />
      <main>
        <Hero />
        <UseCasesSection />
        <WhyHindiSection />
        <HowItWorks />
        <ArticlesSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
