import type { Industry } from "@/types/app";

const now = "2026-06-01T09:00:00.000Z";

export const industries: Industry[] = [
  {
    id: "ind-medical",
    slug: "medical-devices",
    name: "Medical Devices",
    summary:
      "Patient-connected electronics designed for isolation, traceability and a technical file that survives audit.",
    icon: "heart-pulse",
    orderIndex: 1,
    projectCount: 0,
    standards: ["IEC 60601-1", "IEC 60601-1-2", "ISO 13485", "IEC 62304", "ISO 14971"],
    serviceSlugs: [
      "circuit-and-schematic-design",
      "pcb-layout-and-high-speed-design",
      "embedded-systems-and-firmware",
      "test-and-compliance",
    ],
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Medical Device Electronics Design",
    seoDescription:
      "IEC 60601 aligned medical electronics: patient isolation, leakage current control, IEC 62304 firmware and design history file support.",
    bodyHtml: `
<p>Medical electronics carry constraints that do not appear in other sectors, and they appear early. Isolation barriers, creepage and clearance, leakage current limits and single-fault safety shape the schematic before a single component is placed.</p>
<h3>What changes in a medical design</h3>
<p>Patient-connected circuits need a defined means of protection, and the classification drives everything downstream: isolation voltage, barrier width, the transformer specification and the layout keep-outs that protect them. We size these against IEC&nbsp;60601-1 at schematic stage rather than discovering a 4&nbsp;mm clearance problem during layout review.</p>
<p>Leakage current is a system property, not a component property. Y-capacitor selection, enclosure bonding and the mains input filter all contribute, so the budget is allocated deliberately across them.</p>
<h3>Firmware under IEC 62304</h3>
<p>Software safety classification determines how much process a project carries. We work to a documented architecture, unit-tested modules, traceable requirements and a change history that an auditor can follow — proportionate to Class A, B or C rather than uniformly heavy.</p>
<h3>Documentation as a deliverable</h3>
<p>Design inputs, verification results, risk analysis inputs under ISO&nbsp;14971 and the traceability between them are produced as the work happens. Reconstructing a design history file after the fact is the most expensive way to build one.</p>`.trim(),
  },
  {
    id: "ind-industrial",
    slug: "industrial-and-iiot",
    name: "Industrial & IIoT",
    summary:
      "Rugged controllers, gateways and sensor nodes that survive a factory floor and speak the protocols already installed there.",
    icon: "factory",
    orderIndex: 2,
    projectCount: 0,
    standards: ["IEC 61131-2", "EN 61000-6-2", "EN 61000-6-4", "ATEX / IECEx", "IP65–IP68"],
    serviceSlugs: [
      "pcb-layout-and-high-speed-design",
      "embedded-systems-and-firmware",
      "test-and-compliance",
      "manufacturing-support",
    ],
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Industrial & IIoT Electronics Design",
    seoDescription:
      "Industrial controllers and IIoT gateways: wide-range supplies, surge immunity, Modbus and CAN, extended temperature and long product lifecycles.",
    bodyHtml: `
<p>Industrial electronics fail differently. The threat is not a dropped phone; it is a 4&nbsp;kV surge on a 24&nbsp;V line, a variable-speed drive two metres away, condensation, and an expectation of ten years in service.</p>
<h3>Immunity is the design driver</h3>
<p>EN&nbsp;61000-6-2 immunity levels are harder to meet than the emissions limits alongside them. Surge and EFT protection is designed into every port, isolation is placed where the ground reference genuinely differs, and the layout keeps transient energy away from logic rather than routing it through it.</p>
<h3>Protocols that already exist on site</h3>
<p>Modbus RTU and TCP, CANopen, EtherNet/IP, IO-Link and MQTT over TLS. New equipment has to join the installed base, not replace it, so protocol conformance and graceful degradation matter more than feature count.</p>
<h3>Designed for a long life</h3>
<p>Component selection favours lifecycle over unit price: parts with a published longevity programme, second sources on every critical line, and a BOM reviewed annually. A 30&nbsp;cent saving that forces a redesign in year four is not a saving.</p>`.trim(),
  },
  {
    id: "ind-automotive",
    slug: "automotive-and-ev",
    name: "Automotive & EV",
    summary:
      "Power electronics, battery management and vehicle-network hardware built to automotive transient and thermal expectations.",
    icon: "car-front",
    orderIndex: 3,
    projectCount: 0,
    standards: ["ISO 26262", "ISO 7637-2", "AEC-Q100 / Q200", "CISPR 25", "IATF 16949"],
    serviceSlugs: [
      "circuit-and-schematic-design",
      "pcb-layout-and-high-speed-design",
      "embedded-systems-and-firmware",
      "manufacturing-support",
    ],
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Automotive & EV Electronics Design",
    seoDescription:
      "Automotive-grade electronics: ISO 7637-2 transient immunity, AEC-Q qualified parts, CAN FD and LIN, battery management and traction-adjacent power design.",
    bodyHtml: `
<p>A vehicle is an electrically hostile environment with a long warranty attached. Load dump, cold crank, reverse polarity and a −40 to +125&nbsp;°C junction expectation are the starting conditions, not edge cases.</p>
<h3>Transients first</h3>
<p>ISO&nbsp;7637-2 pulses define the front end: reverse-battery protection, load-dump clamping sized to the alternator, and a supply that rides through cold-crank without resetting the processor. Getting this wrong is not a compliance finding, it is a field return.</p>
<h3>Qualified parts, and the discipline that follows</h3>
<p>AEC-Q100 and Q200 parts throughout, with the temperature grade chosen for the actual mounting location rather than the ambient in the cabin. Derating is applied and documented.</p>
<h3>Networks and functional safety</h3>
<p>CAN FD, LIN and automotive Ethernet with correct termination and shielding. Where a function carries an ASIL rating, we work to a documented safety concept with the diagnostic coverage that rating demands — and we say plainly when a requirement needs a certified partner rather than us.</p>`.trim(),
  },
  {
    id: "ind-consumer",
    slug: "consumer-products",
    name: "Consumer Products",
    summary:
      "Compact, cost-sensitive designs where board area, battery life and unit cost are all constraints at once.",
    icon: "smartphone",
    orderIndex: 4,
    projectCount: 0,
    standards: ["IEC 62368-1", "EN 55032 Class B", "EN 300 328", "IEC 62133 (battery)", "FCC Part 15B/15C"],
    serviceSlugs: [
      "pcb-layout-and-high-speed-design",
      "embedded-systems-and-firmware",
      "prototyping-and-bring-up",
      "manufacturing-support",
    ],
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Consumer Electronics Design",
    seoDescription:
      "Compact consumer electronics: HDI layout, BLE and Wi-Fi integration, battery and charging design, and BOM cost reduction for volume manufacture.",
    bodyHtml: `
<p>Consumer hardware is an optimisation problem with three axes pulling against each other: size, battery life and cost. Improving one usually costs another, so the trade-offs have to be made explicitly and early.</p>
<h3>Density with a purpose</h3>
<p>HDI, via-in-pad and rigid-flex are specified when the mechanics genuinely require them, because each adds fabrication cost. A well-placed four-layer board frequently beats a poorly planned eight-layer one on both size and price.</p>
<h3>Battery and charging done properly</h3>
<p>Cell selection, charge topology, protection, fuel gauging and thermal behaviour designed together, with runtime validated by measurement across the real duty cycle. Safety testing to IEC&nbsp;62133 is planned from the start.</p>
<h3>Cost engineering that holds up</h3>
<p>At volume, small decisions compound. Part consolidation, tolerance relaxation where the analysis allows, a test strategy that fits the line, and panelisation tuned to the assembler routinely take 15–35&nbsp;% out of a mature BOM without touching the specification.</p>`.trim(),
  },
  {
    id: "ind-energy",
    slug: "energy-and-power",
    name: "Energy & Power",
    summary:
      "Converters, inverters and metering hardware where efficiency, isolation and thermal design decide the product.",
    icon: "zap",
    orderIndex: 5,
    projectCount: 0,
    standards: ["IEC 62109", "IEC 61010-1", "EN 50549", "IEC 62053 (metering)", "UL 1741"],
    serviceSlugs: [
      "circuit-and-schematic-design",
      "pcb-layout-and-high-speed-design",
      "test-and-compliance",
      "manufacturing-support",
    ],
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Energy & Power Electronics Design",
    seoDescription:
      "Power conversion and energy metering electronics: high-efficiency topologies, GaN and SiC switching, isolation, thermal design and grid-code compliance.",
    bodyHtml: `
<p>In power electronics the layout is the circuit. Loop inductance in a switching cell determines ringing, EMI and switching loss far more than the schematic suggests, and it cannot be fixed in firmware.</p>
<h3>Switching cells laid out deliberately</h3>
<p>Commutation loops kept small and tight, gate drive returned to the source pin, current sense placed where it measures what you think it measures, and thermal paths designed alongside the electrical ones.</p>
<h3>Wide bandgap where it earns its place</h3>
<p>GaN and SiC deliver real efficiency gains and real layout difficulty: faster edges mean tighter loops, more careful gate drive and more attention to common-mode paths. We use them when the application justifies the discipline.</p>
<h3>Measured efficiency, not claimed efficiency</h3>
<p>Efficiency curves across load and line, thermal imaging at worst case, and ripple measured with correct probing. Numbers you can put in a datasheet because they came off a bench.</p>`.trim(),
  },
  {
    id: "ind-agritech",
    slug: "agritech",
    name: "Agritech",
    summary:
      "Outdoor sensing and control that runs for years on a battery, in weather, with intermittent connectivity.",
    icon: "sprout",
    orderIndex: 6,
    projectCount: 0,
    standards: ["IP67 / IP68", "EN 301 511 / 301 908", "EN 62368-1", "IEC 60068-2 (environmental)"],
    serviceSlugs: [
      "embedded-systems-and-firmware",
      "circuit-and-schematic-design",
      "prototyping-and-bring-up",
      "test-and-compliance",
    ],
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Agritech & Environmental Sensing Electronics",
    seoDescription:
      "Battery-powered outdoor sensing: LoRaWAN and NB-IoT nodes, energy harvesting, sealed enclosures and multi-year field deployments.",
    bodyHtml: `
<p>An agritech node is judged on one number: how long it runs before someone has to walk to it. Everything else follows from that.</p>
<h3>Microamps matter</h3>
<p>Sleep current is engineered down to single-digit microamps: leakage paths audited, pull-ups sized, sensors switched rather than left biased, and the radio duty cycle designed against the actual reporting requirement rather than a convenient default.</p>
<h3>Connectivity that assumes failure</h3>
<p>LoRaWAN, NB-IoT and LTE-M with store-and-forward buffering, exponential backoff and a firmware update path that tolerates a partial download. Coverage at the edge of a field is not coverage in a lab.</p>
<h3>Sealed, and proven sealed</h3>
<p>Conformal coating, gasket and gland selection reviewed with mechanical, condensation considered explicitly, and IP performance verified by test rather than by the enclosure's datasheet.</p>`.trim(),
  },
  {
    id: "ind-aerospace",
    slug: "aerospace-and-defence",
    name: "Aerospace & Defence",
    summary:
      "High-reliability electronics with the environmental qualification and documentation the sector requires.",
    icon: "plane",
    orderIndex: 7,
    projectCount: 0,
    standards: ["DO-160G", "MIL-STD-810H", "MIL-STD-461G", "IPC-6012 Class 3", "IPC-A-610 Class 3"],
    serviceSlugs: [
      "circuit-and-schematic-design",
      "pcb-layout-and-high-speed-design",
      "test-and-compliance",
      "manufacturing-support",
    ],
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Aerospace & Defence Electronics Design",
    seoDescription:
      "High-reliability electronics to IPC Class 3, DO-160 and MIL-STD-810 environmental qualification, with full traceability and derating analysis.",
    bodyHtml: `
<p>High-reliability work is mostly a documentation and margin discipline. The circuits are often conventional; the difference is how much is proven rather than assumed.</p>
<h3>Class 3 from the start</h3>
<p>IPC-6012 Class 3 fabrication and IPC-A-610 Class 3 workmanship impose annular ring, plating and acceptance criteria that must be designed for, not requested at the end. We apply them from the first layout.</p>
<h3>Derating and margin analysis</h3>
<p>Every component derated against a published policy, worst-case analysis across temperature and end-of-life, and the results tabulated. Where margin is thin, it is called out rather than averaged away.</p>
<h3>Qualification planned, not improvised</h3>
<p>DO-160 or MIL-STD-810 profiles drive mechanical design, potting and connector selection from day one, and the qualification plan is written alongside the specification.</p>`.trim(),
  },
];

export const industryBySlug = (slug: string) => industries.find((i) => i.slug === slug);
