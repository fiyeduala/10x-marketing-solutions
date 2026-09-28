/**
 * Central, editable content for the 10X Marketing Solutions website.
 *
 * Everything a non-developer is likely to change lives here: identity,
 * contact details, navigation, services, projects and section copy.
 * Service names and project examples are proposed copy — review before launch.
 */

export type Discipline = 'marketing' | 'software';
export type Need = Discipline | 'both';

/* ------------------------------------------------------------------ */
/* Identity & contact                                                  */
/* ------------------------------------------------------------------ */

export const site = {
  name: '10X Marketing Solutions',
  shortName: '10X',
  positioning:
    'Strategy, marketing and software development for ambitious brands.',
  contact: {
    /**
     * Set to a real value (e.g. 'hello@example.com') to activate the mailto link.
     * While null, the literal placeholder text below is shown instead.
     */
    email: '10xpromotionscompany@gmail.com' as string | null,
    /** Set to a real value (e.g. '+00 000 000 0000') to activate the tel link. */
    phone: '07048695731' as string | null,
    emailPlaceholder: '[Your email address]',
    phonePlaceholder: '[Your phone number]',
  },
};

export const nav = [
  { id: 'work', label: 'Work' },
  { id: 'services', label: 'Services' },
  { id: 'approach', label: 'Approach' },
  { id: 'about', label: 'About' },
] as const;

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export const hero = {
  eyebrow: 'Marketing × Software',
  headline: ['Built to grow.', 'Designed to lead.'],
  body: 'Strategy, marketing and software development for ambitious brands.',
  primaryCta: 'Start a project',
  secondaryCta: 'Explore our work',
};

/* ------------------------------------------------------------------ */
/* Capability stage                                                    */
/* ------------------------------------------------------------------ */

export interface Capability {
  id: Need;
  label: string;
  title: string;
  body: string;
  services: string[];
}

export const capabilityStage = {
  heading: 'Strategy meets execution.',
  body: 'We connect the way your business is seen with the way it works.',
  defaultTab: 'both' as Need,
  tabs: [
    {
      id: 'marketing',
      label: 'Marketing',
      title: 'Turn attention into opportunity.',
      body: 'Clear positioning, well-crafted campaigns and landing pages designed to move the right people from interest to enquiry.',
      services: ['Strategy & positioning', 'Paid advertising', 'Content & creative', 'Conversion journeys'],
    },
    {
      id: 'software',
      label: 'Software',
      title: 'Build what’s next.',
      body: 'Websites, web applications and business systems built around how your team actually works — and ready to grow with it.',
      services: ['Websites', 'Web applications', 'Business systems', 'Integrations & automation'],
    },
    {
      id: 'both',
      label: 'Both',
      title: 'One team. A connected approach.',
      body: 'When the message and the machine are planned together, campaigns land on experiences built to receive them — and every tool supports the story.',
      services: ['Brand-led websites', 'Campaign landing systems', 'Ecommerce experiences', 'Lead-to-workflow automation'],
    },
  ] satisfies Capability[],
};

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export interface Service {
  id: string;
  discipline: Discipline;
  name: string;
  outcome: string;
  scope: string[];
}

export const services: Service[] = [
  {
    id: 'strategy',
    discipline: 'marketing',
    name: 'Strategy and positioning',
    outcome: 'A clear account of who you serve, what sets you apart and where to focus first.',
    scope: ['Audience and competitor review', 'Positioning and messaging framework', 'Channel priorities and roadmap'],
  },
  {
    id: 'paid',
    discipline: 'marketing',
    name: 'Paid advertising',
    outcome: 'Campaigns planned around your goals, tested with intent and refined as you learn.',
    scope: ['Campaign structure and targeting', 'Ad creative and copy variations', 'Measurement setup and regular review'],
  },
  {
    id: 'content',
    discipline: 'marketing',
    name: 'Content and creative',
    outcome: 'Visuals and words that make your brand recognisable and your offer easy to understand.',
    scope: ['Campaign concepts and art direction', 'Social and editorial content', 'Brand asset templates'],
  },
  {
    id: 'seo',
    discipline: 'marketing',
    name: 'SEO and landing pages',
    outcome: 'Pages that are easier to find and built to turn a visit into a next step.',
    scope: ['Technical and on-page SEO review', 'Landing page copy and design', 'Structured content planning'],
  },
  {
    id: 'nurture',
    discipline: 'marketing',
    name: 'Lead nurturing and conversion',
    outcome: 'Follow-up journeys that keep interested people moving towards a decision.',
    scope: ['Email and message sequences', 'Form and funnel improvements', 'Lead handover processes'],
  },
  {
    id: 'websites',
    discipline: 'software',
    name: 'Website development',
    outcome: 'Fast, accessible websites your team can update with confidence.',
    scope: ['Responsive design and build', 'Content management setup', 'Performance and accessibility checks'],
  },
  {
    id: 'webapps',
    discipline: 'software',
    name: 'Web applications',
    outcome: 'Purpose-built tools that turn a manual process into a dependable product.',
    scope: ['Product discovery and prototyping', 'Front-end and back-end development', 'Testing and release support'],
  },
  {
    id: 'systems',
    discipline: 'software',
    name: 'Business management systems',
    outcome: 'One organised place for the records, tasks and reports your operations rely on.',
    scope: ['Workflow mapping', 'Dashboards and role-based access', 'Data migration planning'],
  },
  {
    id: 'ecommerce',
    discipline: 'software',
    name: 'Ecommerce experiences',
    outcome: 'Storefronts that make browsing simple and checking out straightforward.',
    scope: ['Catalogue and product page design', 'Cart and checkout journeys', 'Payment and fulfilment integration planning'],
  },
  {
    id: 'automation',
    discipline: 'software',
    name: 'Integrations and workflow automation',
    outcome: 'Connected tools that remove repetitive work and keep information in sync.',
    scope: ['Integration audit', 'API connections between existing tools', 'Automated notifications and handovers'],
  },
];

/* ------------------------------------------------------------------ */
/* Selected work                                                       */
/* ------------------------------------------------------------------ */

export type ProjectVisual = 'campaign' | 'dashboard' | 'commerce';

export interface Project {
  id: string;
  title: string;
  /**
   * true = illustrative concept, labelled "Concept project" on the site.
   * Set to false only for real, approved client work.
   */
  isConcept: boolean;
  disciplines: Discipline[];
  category: string;
  summary: string;
  brief: string;
  scope: string[];
  deliverables: string[];
  /** Built-in illustrated visual. Replace with `image` once real assets exist. */
  visual: ProjectVisual;
  /** Optional approved image, e.g. '/work/brand-launch.webp'. Takes priority over `visual`. */
  image?: { src: string; alt: string; width: number; height: number };
}

export const work = {
  heading: 'Ideas made tangible.',
  intro:
    'A look at the kind of work we shape. These are concept projects — illustrations of approach, not client case studies.',
};

export const projects: Project[] = [
  {
    id: 'brand-launch',
    title: 'Brand launch campaign',
    isConcept: true,
    disciplines: ['marketing'],
    category: 'Marketing · Campaign',
    summary: 'Art-directed campaign layouts and a landing page that carries the story through to action.',
    brief:
      'A new brand needs to introduce itself with confidence. The concept pairs a bold typographic campaign system with a focused landing page so every ad and post leads somewhere coherent.',
    scope: ['Campaign concept and messaging', 'Art direction across formats', 'Landing page design'],
    deliverables: ['Key campaign visuals', 'Social and display ad set', 'Launch landing page', 'Brand usage notes'],
    visual: 'campaign',
  },
  {
    id: 'ops-dashboard',
    title: 'Business operations dashboard',
    isConcept: true,
    disciplines: ['software'],
    category: 'Software · Web application',
    summary: 'A calm, well-organised interface bringing orders, tasks and reporting into one view.',
    brief:
      'A growing team juggles spreadsheets and messages to track daily operations. The concept gathers that work into a single dashboard with clear priorities, role-based views and simple reporting. All figures shown are illustrative.',
    scope: ['Workflow discovery', 'Interface and interaction design', 'Front-end architecture'],
    deliverables: ['Clickable prototype', 'Design system components', 'Dashboard and reporting views', 'Technical handover notes'],
    visual: 'dashboard',
  },
  {
    id: 'commerce',
    title: 'Commerce experience',
    isConcept: true,
    disciplines: ['marketing', 'software'],
    category: 'Marketing + Software · Ecommerce',
    summary: 'A storefront and customer journey designed together, from first impression to checkout.',
    brief:
      'An independent retailer wants its online shop to feel as considered as its products. The concept joins campaign-led merchandising with a streamlined mobile-first buying journey.',
    scope: ['Customer journey mapping', 'Storefront and product page design', 'Checkout flow and integrations planning'],
    deliverables: ['Storefront design', 'Mobile product and cart flows', 'Launch campaign assets', 'Build specification'],
    visual: 'commerce',
  },
];

/* ------------------------------------------------------------------ */
/* Approach                                                            */
/* ------------------------------------------------------------------ */

export const approach = {
  heading: 'A clear path from question to launch.',
  stages: [
    {
      name: 'Discover',
      body: 'We learn how your business works, who you serve and what success should look like — before recommending anything.',
    },
    {
      name: 'Define',
      body: 'We agree priorities, scope and a practical plan, so everyone knows what is being made and why.',
    },
    {
      name: 'Create',
      body: 'Strategy, design and development move together in visible iterations, with regular chances to review.',
    },
    {
      name: 'Refine',
      body: 'After launch we review what is working, fix what isn’t and plan the sensible next improvement.',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* About                                                               */
/* ------------------------------------------------------------------ */

export const about = {
  heading: 'Creative thinking. Practical execution.',
  body: '10X Marketing Solutions brings marketing and software development together to help businesses communicate clearly, reach the right people and build better digital experiences.',
  principles: [
    {
      title: 'Clarity before complexity',
      body: 'We make the problem simple to understand before we make anything to solve it.',
    },
    {
      title: 'Design with purpose',
      body: 'Every visual and interaction should help someone understand, decide or act.',
    },
    {
      title: 'Build for real use',
      body: 'We build for the people who will rely on it every day, not just for launch day.',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

export const contact = {
  heading: 'What are you building next?',
  body: 'Tell us about the idea, the challenge or the next step. We’ll help you work out where to begin.',
  cta: 'Start a project',
};

export const timelines = ['As soon as possible', 'Within 1–3 months', 'Within 3–6 months', 'Just exploring'];
