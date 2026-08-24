import type {
  Certification, Client, Faq, NavItem, ProcessStage, SiteSettings, StatValue, TeamMember, Testimonial,
} from "@/types/app";
import { avatar } from "./media";

export const settings: SiteSettings = {
  hero: {
    eyebrow: "Electronics Design Services",
    headlineLines: ["We design.", "Engineer.", "Bring ideas to life."],
    accentWord: "life.",
    subcopy:
      "Anode delivers end-to-end electronic design solutions from concept and prototyping to production-ready products that make an impact.",
    ctaPrimary: { label: "Explore Services", href: "/services" },
    ctaSecondary: { label: "View Our Work", href: "/projects" },
    proofCaption: "for startups and brands worldwide",
  },
  copy: {
    processHeading: "A streamlined process.\nBuilt for results.",
    ctaBand: {
      heading: "Have a board that needs designing?",
      body: "Send us the constraints — schematic, mechanical envelope, volume, timeline. You will get a considered response from an engineer within one business day, not a brochure.",
      primary: { label: "Request a Quote", href: "/quote" },
      secondary: { label: "Talk to an engineer", href: "/contact" },
    },
    sectionHeadings: {
      services: {
        eyebrow: "What We Do",
        heading: "Complete electronics design solutions under one roof.",
        intro: "We handle every stage of the product development lifecycle with precision, innovation and care.",
      },
      work: { eyebrow: "Featured Work", heading: "Ideas we've brought to life." },
      clients: { eyebrow: "Trusted by Innovators", heading: "" },
      industries: {
        eyebrow: "Industries",
        heading: "Sectors we build for.",
        intro: "Each one imposes its own constraints — compliance, environment, lifecycle. We design to them from the first schematic sheet.",
      },
      why: {
        eyebrow: "Why Anode",
        heading: "Engineering judgement you can audit.",
        intro: "Four things clients tell us make the difference, each one measurable rather than asserted.",
      },
      insights: {
        eyebrow: "Insights",
        heading: "Notes from the bench.",
        intro: "Practical write-ups from problems we have actually had to solve.",
      },
      process: { eyebrow: "Our Process", heading: "A streamlined process. Built for results." },
    },
    differentiators: [
      {
        icon: "search-check",
        title: "We tell you what we measured",
        claim: "Every claim in a report traces to a number from a bench.",
        evidence:
          "Efficiency curves, noise floors, thermal images and current traces are delivered as data, not adjectives. Where margin is thin we say so rather than averaging it away.",
      },
      {
        icon: "layers",
        title: "Hardware and firmware in one team",
        claim: "Test points land where debug actually needs them.",
        evidence:
          "Because the same engineers lay out the board and write the bring-up firmware, pin assignments respect the routing and the peripheral matrix at the same time — and bring-up starts the day boards arrive.",
      },
      {
        icon: "file-check",
        title: "Documentation is a deliverable",
        claim: "You receive source files, not a PDF and a dependency on us.",
        evidence:
          "Altium or KiCad projects, firmware repositories, build systems, test procedures and an issue register with every finding, its root cause and its disposition.",
      },
      {
        icon: "shield-check",
        title: "Compliance designed in, not chased",
        claim: "First-time EMC pass rate across the last 24 projects: 21 of 24.",
        evidence:
          "Pre-compliance probing happens on the first prototype, while the layout can still change. The three that failed did so on findings we had already flagged as accepted risks.",
      },
    ],
    comparison: {
      columns: ["In-house hire", "Freelance contractor", "Anode"],
      rows: [
        { label: "Time to productive output", cells: ["3–6 months", "1–3 weeks", "1 week"] },
        { label: "Breadth across analog, PCB, firmware", cells: ["One specialism", "One specialism", "Full team"] },
        { label: "Lab and instrumentation", cells: ["You buy it", "Usually none", "Included"] },
        { label: "Cover during absence", cells: ["None", "None", "Team continuity"] },
        { label: "Compliance experience", cells: ["Varies", "Varies", "Standing capability"] },
        { label: "You own the source files", cells: ["Yes", "Negotiable", "Yes, always"] },
        { label: "Commitment", cells: ["Permanent headcount", "Per engagement", "Per project or retained"] },
      ],
    },
  },
  contact: {
    companyName: "Anode",
    legalName: "Anode Electronics Ltd",
    email: "hello@anode.example",
    salesEmail: "quotes@anode.example",
    phone: "+44 20 7946 0231",
    addressLines: ["Unit 12, Kestrel Works", "48 Faraday Road", "Cambridge CB1 3TN", "United Kingdom"],
    hours: [
      { day: "Monday – Thursday", hours: "08:30 – 18:00" },
      { day: "Friday", hours: "08:30 – 16:30" },
      { day: "Saturday – Sunday", hours: "Closed" },
    ],
    responsePromise: "We reply within one business day, from an engineer.",
    geo: { lat: 52.2053, lng: 0.1218, zoom: 13 },
  },
  social: [
    { label: "LinkedIn", href: "https://www.linkedin.com/company/anode", icon: "linkedin" },
    { label: "GitHub", href: "https://github.com/anode", icon: "github" },
    { label: "YouTube", href: "https://youtube.com/@anode", icon: "youtube" },
  ],
  seo: {
    titleTemplate: "%s | Anode",
    defaultTitle: "Anode — Electronics Design & Engineering",
    description:
      "Anode delivers end-to-end electronics design: circuit and schematic design, high-speed multilayer PCB layout, embedded firmware, prototyping, test and manufacturing support.",
    timezone: "Europe/London",
  },
  features: { pcb3d: true, newsletter: true, search: true, insights: true },
};

/* ---------------------------------------------------------------- process */

export const processStages: ProcessStage[] = [
  {
    id: "ps-1",
    stepNumber: 1,
    title: "Discover",
    shortDescription: "We understand your idea, goals and requirements.",
    icon: "lightbulb",
    detail: {
      inputs: ["Product concept or existing design", "Target market and compliance regime", "Volume, cost and timeline targets", "Any existing schematics, BOM or field data"],
      activities: ["Requirements workshop", "Feasibility and risk assessment", "Architecture options with trade-offs", "Preliminary BOM cost and lead-time modelling"],
      outputs: ["Written requirements specification", "System architecture and power tree", "Risk register with mitigations", "Fixed-price proposal and schedule"],
      duration: "1–2 weeks",
      gate: "You sign off the requirements specification. Nothing is designed against an assumption we have not written down.",
    },
  },
  {
    id: "ps-2",
    stepNumber: 2,
    title: "Design",
    shortDescription: "We design and engineer with accuracy and insight.",
    icon: "pen-tool",
    detail: {
      inputs: ["Approved requirements specification", "Mechanical envelope as STEP", "Preferred suppliers and approved vendor list"],
      activities: ["Schematic capture and simulation", "Component selection with second sources", "Layer stack-up agreed with the fabricator", "PCB layout, SI/PI analysis, DFM review"],
      outputs: ["Reviewed schematic set", "Routed board with analysis reports", "Manufacturing data pack", "Design review minutes and issue register"],
      duration: "4–10 weeks",
      gate: "Formal design review with you present. Every open issue is dispositioned before fabrication is released.",
    },
  },
  {
    id: "ps-3",
    stepNumber: 3,
    title: "Develop",
    shortDescription: "We build, test and refine until it's perfect.",
    icon: "settings-2",
    detail: {
      inputs: ["Released fabrication and assembly data", "Firmware requirements", "Test and acceptance criteria"],
      activities: ["Prototype build and first-article inspection", "Structured bring-up against a written procedure", "Firmware development with CI and unit tests", "Characterisation and EMC pre-compliance"],
      outputs: ["Working prototypes with measured data", "Firmware with test suite and build pipeline", "Characterisation report", "Revised design for release"],
      duration: "6–14 weeks",
      gate: "Measured performance meets the specification across the operating range, with the evidence attached.",
    },
  },
  {
    id: "ps-4",
    stepNumber: 4,
    title: "Deliver",
    shortDescription: "Production ready, on time and beyond expectations.",
    icon: "rocket",
    detail: {
      inputs: ["Release-candidate design", "Target contract manufacturer", "Volume forecast"],
      activities: ["Final DFM/DFA and BOM optimisation", "Panelisation and process data", "Production test fixture and software", "CM liaison and first-article support"],
      outputs: ["Complete manufacturing data pack", "Optimised BOM with alternates", "Test fixture and coverage report", "Handover documentation and source files"],
      duration: "3–6 weeks",
      gate: "A successful first production run at your manufacturer, with yield data reviewed together.",
    },
  },
];

/* ------------------------------------------------------------------ team */

export const team: TeamMember[] = [
  {
    id: "tm-1", name: "Dr Priya Raghavan", role: "Founder & Principal Engineer", orderIndex: 1,
    photo: avatar(1, "Portrait of Dr Priya Raghavan"), linkedinUrl: "https://linkedin.com/in/example",
    bio: "Eighteen years in mixed-signal and power electronics, previously leading hardware for a medical diagnostics platform through IEC 60601 certification in four markets. Writes most of our worst-case analysis.",
  },
  {
    id: "tm-2", name: "Tomas Lindqvist", role: "Head of PCB Engineering", orderIndex: 2,
    photo: avatar(2, "Portrait of Tomas Lindqvist"), linkedinUrl: "https://linkedin.com/in/example",
    bio: "Specialist in high-speed and HDI layout — DDR4, PCIe Gen3 and gigabit interfaces. Maintains our stack-up library and the relationships with the fabricators who build to it.",
  },
  {
    id: "tm-3", name: "Marcus Adeyemi", role: "Lead Firmware Engineer", orderIndex: 3,
    photo: avatar(3, "Portrait of Marcus Adeyemi"), linkedinUrl: "https://linkedin.com/in/example",
    bio: "Zephyr and bare-metal C across STM32, nRF and ESP32. Built the secure boot and OTA framework we reuse across connected projects, and insists that everything is testable on a host.",
  },
  {
    id: "tm-4", name: "Elena Fischer", role: "Test & Compliance Lead", orderIndex: 4,
    photo: avatar(4, "Portrait of Elena Fischer"), linkedinUrl: "https://linkedin.com/in/example",
    bio: "Runs our pre-compliance lab and production test development. Has taken more than sixty products through EMC and safety testing and keeps the record of why each one passed or did not.",
  },
  {
    id: "tm-5", name: "Daniel Okonkwo", role: "Manufacturing Engineer", orderIndex: 5,
    photo: avatar(5, "Portrait of Daniel Okonkwo"), linkedinUrl: null,
    bio: "Ten years on the CM side before joining us, which is why our DFM feedback is specific rather than generic. Owns BOM optimisation and supplier risk analysis.",
  },
  {
    id: "tm-6", name: "Sara Beltrán", role: "Analog & Power Engineer", orderIndex: 6,
    photo: avatar(6, "Portrait of Sara Beltrán"), linkedinUrl: "https://linkedin.com/in/example",
    bio: "Switching converters, GaN and SiC gate drive, and the precision front ends where a microvolt matters. Responsible for our lowest-noise designs and our highest-efficiency ones.",
  },
];

/* ---------------------------------------------------------- testimonials */

export const testimonials: Testimonial[] = [
  {
    id: "t-1", featured: true, projectSlug: "iot-environmental-monitor", industrySlug: "industrial-and-iiot",
    quote:
      "We had spent nine months correcting a sensor error in firmware. Anode found it was a thermal path in the layout, fixed it in one revision, and handed us the measurements that proved it. The calibration interval more than doubled.",
    authorName: "Helena Vos", authorRole: "VP Product", company: "Aeris Building Systems", avatar: avatar(2, "Portrait of Helena Vos"),
  },
  {
    id: "t-2", featured: true, projectSlug: "industrial-controller", industrySlug: "industrial-and-iiot",
    quote:
      "They took 31 % out of our BOM without touching the specification, and showed the working for every line. That is the first cost-down exercise I have seen that did not quietly move risk somewhere else.",
    authorName: "Jonas Kessler", authorRole: "Managing Director", company: "Kessler Automation", avatar: avatar(3, "Portrait of Jonas Kessler"),
  },
  {
    id: "t-3", featured: false, projectSlug: "ev-charging-module", industrySlug: "energy-and-power",
    quote:
      "Two suppliers had told us the nuisance trips were inherent to the sensor. Anode reframed it as a measurement window problem and we have had zero trips in ninety days of field trial.",
    authorName: "Amara Diallo", authorRole: "Head of Engineering", company: "Voltix Mobility", avatar: avatar(4, "Portrait of Amara Diallo"),
  },
  {
    id: "t-4", featured: false, projectSlug: "soil-sensing-node", industrySlug: "agritech",
    quote:
      "Fourteen months of battery life became five years. The audit that found it took two days. We should have asked them a year earlier.",
    authorName: "Rory McAllister", authorRole: "CTO", company: "Bluente Agritech", avatar: avatar(5, "Portrait of Rory McAllister"),
  },
];

/* --------------------------------------------------------------- clients */

export const clients: Client[] = [
  { id: "c-1", name: "TechNova", logoMark: "grid-2x2", websiteUrl: null, featured: true, orderIndex: 1 },
  { id: "c-2", name: "Intelliq", logoMark: "square-dashed", websiteUrl: null, featured: true, orderIndex: 2 },
  { id: "c-3", name: "Voltix", logoMark: "diamond", websiteUrl: null, featured: true, orderIndex: 3 },
  { id: "c-4", name: "Nexora", logoMark: "hexagon", websiteUrl: null, featured: true, orderIndex: 4 },
  { id: "c-5", name: "Bluente", logoMark: "anchor", websiteUrl: null, featured: true, orderIndex: 5 },
  { id: "c-6", name: "CorePeak", logoMark: "circle-dot", websiteUrl: null, featured: true, orderIndex: 6 },
  { id: "c-7", name: "Aeris", logoMark: "wind", websiteUrl: null, featured: false, orderIndex: 7 },
  { id: "c-8", name: "Kessler", logoMark: "cog", websiteUrl: null, featured: false, orderIndex: 8 },
];

/* ----------------------------------------------------------------- stats */

export const stats: StatValue[] = [
  { id: "s-1", label: "Projects Delivered", value: 100, prefix: "", suffix: "+", context: "home", orderIndex: 1 },
  { id: "s-2", label: "Years in electronics design", value: 12, prefix: "", suffix: "", context: "home", orderIndex: 2 },
  { id: "s-3", label: "First-time EMC pass rate", value: 88, prefix: "", suffix: "%", context: "home", orderIndex: 3 },
  { id: "s-4", label: "Average concept to prototype", value: 9, prefix: "", suffix: " wks", context: "home", orderIndex: 4 },
  { id: "s-5", label: "Boards laid out", value: 340, prefix: "", suffix: "+", context: "about", orderIndex: 1 },
  { id: "s-6", label: "Engineers on the team", value: 14, prefix: "", suffix: "", context: "about", orderIndex: 2 },
  { id: "s-7", label: "Countries shipped to", value: 23, prefix: "", suffix: "", context: "about", orderIndex: 3 },
  { id: "s-8", label: "Average BOM reduction", value: 24, prefix: "", suffix: "%", context: "why", orderIndex: 1 },
  { id: "s-9", label: "Median prototype revisions", value: 2, prefix: "", suffix: "", context: "why", orderIndex: 2 },
  { id: "s-10", label: "Clients who return", value: 78, prefix: "", suffix: "%", context: "why", orderIndex: 3 },
];

/* -------------------------------------------------------- certifications */

export const certifications: Certification[] = [
  { id: "cert-1", name: "ISO 9001:2015", issuer: "BSI", description: "Quality management system covering design, verification and handover.", validUntil: "2027-04-30" },
  { id: "cert-2", name: "ISO 13485:2016", issuer: "BSI", description: "Medical device design controls, applied to our medical electronics work.", validUntil: "2027-02-28" },
  { id: "cert-3", name: "IPC-A-610 CIS", issuer: "IPC", description: "Certified IPC Specialists on staff for Class 2 and Class 3 workmanship.", validUntil: null },
  { id: "cert-4", name: "IPC CID+", issuer: "IPC", description: "Advanced Certified Interconnect Designers leading our layout team.", validUntil: null },
];

/* ------------------------------------------------------------------ FAQs */

export const faqs: Faq[] = [
  { id: "q-1", scope: "services", orderIndex: 1, question: "Can you take a project from a napkin sketch through to production?", answer: "Yes — that is the common case. Discovery turns the concept into a written specification, and we carry it through schematic, layout, firmware, prototyping, compliance and manufacturing transfer. You can also join at any single stage if you already have work in progress." },
  { id: "q-2", scope: "services", orderIndex: 2, question: "Do we own the design files at the end?", answer: "Always, and without negotiation. You receive the Altium or KiCad source project, firmware repositories, build systems, test procedures and manufacturing data. There is no scenario where you need us in order to build your own product." },
  { id: "q-3", scope: "services", orderIndex: 3, question: "Will you work with our existing manufacturer?", answer: "Yes. We review against their published capability rather than a generic rule set, and we handle the technical liaison during quoting, first article and ramp. If you would like an introduction to a manufacturer instead, we can evaluate options on like-for-like terms." },
  { id: "q-4", scope: "services", orderIndex: 4, question: "How do you handle NDAs and confidential work?", answer: "We sign your NDA before any technical discussion — sending your own is the fastest route. Roughly a third of our work is under confidentiality and does not appear in our case studies at all." },
  { id: "q-5", scope: "process", orderIndex: 1, question: "How long does a typical project take?", answer: "Concept to a working prototype averages nine weeks for a moderate-complexity board. A full programme through compliance and manufacturing transfer typically runs four to eight months. Discovery gives you a fixed schedule before anything is committed." },
  { id: "q-6", scope: "process", orderIndex: 2, question: "How many prototype revisions should we budget for?", answer: "Two is our median; three is normal for a high-speed or high-power design carrying novel risk. A project that reaches revision five usually had an unresolved requirement, which is why discovery ends with a signed specification." },
  { id: "q-7", scope: "process", orderIndex: 3, question: "What happens if the design does not meet the specification?", answer: "It is our responsibility to close the gap. Characterisation happens against the written specification, findings go into an issue register with a root cause, and we iterate until the measured performance meets the target or you formally accept a deviation." },
  { id: "q-8", scope: "quote", orderIndex: 1, question: "What do you need in order to quote?", answer: "The more constraints you can give, the tighter the quote: what the product does, the environment and compliance regime, expected volume, timeline and any existing schematics or BOM. If you only have a concept, tell us that and we will quote discovery first." },
  { id: "q-9", scope: "quote", orderIndex: 2, question: "How do you price work?", answer: "Fixed price per phase wherever the scope allows it, which is most of the time. Exploratory or research-heavy work is time and materials with a capped budget and a written review point. We do not bill for scope we caused." },
  { id: "q-10", scope: "quote", orderIndex: 3, question: "Is there a minimum project size?", answer: "No hard minimum. We take on short reviews — a DFM audit, a BOM risk assessment, an EMC investigation — as readily as full programmes, and they are often how a longer relationship starts." },
  { id: "q-11", scope: "pcb-layout-and-high-speed-design", orderIndex: 1, question: "What is the highest layer count and density you work with?", answer: "Routinely up to 16 layers, HDI with 1+N+1 and 2+N+2 microvia builds, 0.4 mm pitch BGA fan-out and rigid-flex. We specify density only where the mechanics genuinely require it — a well-placed four-layer board often beats a rushed eight-layer one." },
  { id: "q-12", scope: "embedded-systems-and-firmware", orderIndex: 1, question: "Do you provide firmware for hardware you did not design?", answer: "Yes, including bring-up and debugging of boards from other suppliers. We start with a review of the schematic and layout, because roughly a third of 'firmware' problems we are handed turn out to be hardware." },
];

/* ------------------------------------------------------------ navigation */

const n = (id: string, label: string, href: string, extra: Partial<NavItem> = {}): NavItem => ({
  id, label, href, description: null, icon: null, location: "header", columnGroup: null,
  children: [], isExternal: false, orderIndex: 0, ...extra,
});

export const navigation: NavItem[] = [
  n("nav-services", "Services", "/services", {
    orderIndex: 1,
    children: [
      n("nav-s1", "Circuit & Schematic Design", "/services/circuit-and-schematic-design", { description: "Topology, analog front ends and manufacturable schematics.", icon: "cpu" }),
      n("nav-s2", "PCB Layout & High-Speed", "/services/pcb-layout-and-high-speed-design", { description: "Controlled impedance, clean returns, dense assemblies.", icon: "circuit-board" }),
      n("nav-s3", "Embedded & Firmware", "/services/embedded-systems-and-firmware", { description: "Testable firmware with secure boot and OTA update.", icon: "microchip" }),
      n("nav-s4", "Prototyping & Bring-Up", "/services/prototyping-and-bring-up", { description: "Structured bring-up and characterisation you can trust.", icon: "box" }),
      n("nav-s5", "Test & Compliance", "/services/test-and-compliance", { description: "Pre-compliance, verification and production test.", icon: "clipboard-check" }),
      n("nav-s6", "Manufacturing Support", "/services/manufacturing-support", { description: "DFM, DFA, BOM optimisation and transfer.", icon: "factory" }),
    ],
  }),
  n("nav-work", "Work", "/projects", { orderIndex: 2 }),
  n("nav-industries", "Industries", "/industries", {
    orderIndex: 3,
    children: [
      n("nav-i1", "Medical Devices", "/industries/medical-devices", { icon: "heart-pulse" }),
      n("nav-i2", "Industrial & IIoT", "/industries/industrial-and-iiot", { icon: "factory" }),
      n("nav-i3", "Automotive & EV", "/industries/automotive-and-ev", { icon: "car-front" }),
      n("nav-i4", "Consumer Products", "/industries/consumer-products", { icon: "smartphone" }),
      n("nav-i5", "Energy & Power", "/industries/energy-and-power", { icon: "zap" }),
      n("nav-i6", "Agritech", "/industries/agritech", { icon: "sprout" }),
      n("nav-i7", "Aerospace & Defence", "/industries/aerospace-and-defence", { icon: "plane" }),
    ],
  }),
  n("nav-process", "Process", "/process", { orderIndex: 4 }),
  n("nav-about", "About", "/about", {
    orderIndex: 5,
    children: [
      n("nav-a1", "About Anode", "/about", { icon: "building-2" }),
      n("nav-a2", "Why Anode", "/why-anode", { icon: "award" }),
      n("nav-a3", "The Team", "/about/team", { icon: "users" }),
      n("nav-a4", "Lab & Facilities", "/about/facilities", { icon: "flask-conical" }),
    ],
  }),
  n("nav-insights", "Insights", "/insights", { orderIndex: 6 }),
];

export const footerNavigation: NavItem[] = [
  n("f-s1", "Circuit & Schematic Design", "/services/circuit-and-schematic-design", { location: "footer", columnGroup: "Services", orderIndex: 1 }),
  n("f-s2", "PCB Layout & High-Speed", "/services/pcb-layout-and-high-speed-design", { location: "footer", columnGroup: "Services", orderIndex: 2 }),
  n("f-s3", "Embedded & Firmware", "/services/embedded-systems-and-firmware", { location: "footer", columnGroup: "Services", orderIndex: 3 }),
  n("f-s4", "Prototyping & Bring-Up", "/services/prototyping-and-bring-up", { location: "footer", columnGroup: "Services", orderIndex: 4 }),
  n("f-s5", "Test & Compliance", "/services/test-and-compliance", { location: "footer", columnGroup: "Services", orderIndex: 5 }),
  n("f-s6", "Manufacturing Support", "/services/manufacturing-support", { location: "footer", columnGroup: "Services", orderIndex: 6 }),

  n("f-c1", "About Anode", "/about", { location: "footer", columnGroup: "Company", orderIndex: 1 }),
  n("f-c2", "Why Anode", "/why-anode", { location: "footer", columnGroup: "Company", orderIndex: 2 }),
  n("f-c3", "The Team", "/about/team", { location: "footer", columnGroup: "Company", orderIndex: 3 }),
  n("f-c4", "Lab & Facilities", "/about/facilities", { location: "footer", columnGroup: "Company", orderIndex: 4 }),
  n("f-c5", "Our Process", "/process", { location: "footer", columnGroup: "Company", orderIndex: 5 }),

  n("f-r1", "Case Studies", "/projects", { location: "footer", columnGroup: "Resources", orderIndex: 1 }),
  n("f-r2", "Industries", "/industries", { location: "footer", columnGroup: "Resources", orderIndex: 2 }),
  n("f-r3", "Insights", "/insights", { location: "footer", columnGroup: "Resources", orderIndex: 3 }),
  n("f-r4", "Request a Quote", "/quote", { location: "footer", columnGroup: "Resources", orderIndex: 4 }),
  n("f-r5", "Contact", "/contact", { location: "footer", columnGroup: "Resources", orderIndex: 5 }),

  n("f-l1", "Privacy Policy", "/legal/privacy", { location: "footer", columnGroup: "Legal", orderIndex: 1 }),
  n("f-l2", "Terms of Service", "/legal/terms", { location: "footer", columnGroup: "Legal", orderIndex: 2 }),
  n("f-l3", "Cookie Policy", "/legal/cookies", { location: "footer", columnGroup: "Legal", orderIndex: 3 }),
];
