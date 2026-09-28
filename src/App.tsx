import { MotionConfig } from 'motion/react';
import { EnquiryProvider } from './context/EnquiryContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CapabilityStage } from './components/CapabilityStage';
import { WorkGallery } from './components/WorkGallery';
import { ServiceList } from './components/ServiceList';
import { Approach } from './components/Approach';
import { About } from './components/About';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { ProjectEnquiry } from './components/ProjectEnquiry';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <EnquiryProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div id="top" />
        <Header />
        <main id="main" tabIndex={-1}>
          <Hero />
          <CapabilityStage />
          <WorkGallery />
          <ServiceList />
          <Approach />
          <About />
          <Contact />
        </main>
        <Footer />
        <ProjectEnquiry />
      </EnquiryProvider>
    </MotionConfig>
  );
}
