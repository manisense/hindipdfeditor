import { MotionConfig } from "motion/react";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { ComparisonSection } from "./ComparisonSection";
import { UseCasesSection } from "./UseCasesSection";
import { ArticlesSection } from "./ArticlesSection";
import { WorkYourWay } from "./WorkYourWay";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import "../home.css";

/** Marketing home — design from hindipdfeditor landing, wired to our tools. */
export function HomePage() {
  return (
    // reducedMotion="user": with the OS "reduce motion" setting on, every motion/react
    // transform is skipped and only opacity fades remain.
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
  );
}
