import { Nav } from './Nav';
import { Hero } from './Hero';
import { Features } from './Features';
import { WorkYourWay } from './WorkYourWay';
import { Privacy } from './Privacy';
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
        <WorkYourWay />
        <Privacy />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
