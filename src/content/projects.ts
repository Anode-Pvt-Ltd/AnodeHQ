import type { Project } from "@/types/app";
import { img } from "./media";
import { services } from "./services";

const svc = (slug: string) => {
  const s = services.find((x) => x.slug === slug)!;
  return { slug: s.slug, title: s.title, summary: s.summary, icon: s.icon };
};

const now = "2026-06-01T09:00:00.000Z";

export const projects: Project[] = [
  {
    id: "prj-env",
    slug: "iot-environmental-monitor",
    title: "IoT Environmental Monitor",
    summary:
      "A wall-mounted indoor air quality monitor measuring CO₂, PM2.5, VOC, temperature and humidity, reporting over Wi-Fi with a two-year calibration interval.",
    year: 2025,
    clientName: "Aeris Building Systems",
    isConfidential: false,
    cover: img("proj-env-monitor", "Indoor environmental monitor showing a live CO2 reading on its display"),
    industry: { slug: "industrial-and-iiot", name: "Industrial & IIoT" },
    services: [
      svc("circuit-and-schematic-design"),
      svc("pcb-layout-and-high-speed-design"),
      svc("embedded-systems-and-firmware"),
    ],
    durationWeeks: 18,
    featured: true,
    orderIndex: 1,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "IoT Environmental Monitor — Case Study",
    seoDescription:
      "Six-layer NDIR air quality monitor with 0.4 °C self-heating error, Wi-Fi reporting and a two-year calibration interval.",
    boardSpec: {
      layers: 6,
      sizeMm: [78, 52],
      componentCount: 214,
      ipcClass: "Class 2",
      stackup: "1.6 mm FR-4 Tg150, 1 oz outer / 0.5 oz inner, ENIG",
    },
    challenge:
      "The client's previous unit read 2–3 °C high because the temperature sensor sat in the thermal plume of the Wi-Fi module and the switching regulator. Calibration drift meant field re-calibration every nine months, and the sensor fusion could not distinguish a real CO₂ event from a self-heating artefact.",
    approach:
      "We treated self-heating as a layout problem rather than a firmware correction. The temperature and humidity sensors moved onto a thermally isolated tab connected by a 1.2 mm neck with the copper deliberately starved, and slots were milled either side to break the conduction path. The radio and the buck converter were relocated to the opposite end of the board with a ground pour discontinuity between the zones. Firmware duty-cycles the NDIR lamp and takes the temperature reading 400 ms into the sleep window, after the plume has settled.",
    outcome:
      "Self-heating error fell from 2.6 °C to 0.4 °C, which removed the need for the correction table entirely. Drift over the first twelve months of field data stayed inside the sensor's own specification, allowing the calibration interval to be extended to two years. The unit passed EN 55032 Class B radiated emissions on the first chamber visit with 6 dB of margin.",
    metrics: [
      { label: "Self-heating error", value: "−2.2", unit: "°C" },
      { label: "Calibration interval", value: "9 → 24", unit: "months" },
      { label: "EMC margin", value: "6", unit: "dB" },
      { label: "Prototype revisions", value: "2", unit: null },
    ],
    gallery: [
      { media: img("board-layout", "Six-layer layout showing the thermally isolated sensor tab"), caption: "The sensor tab, isolated by a starved-copper neck and two milled slots." },
      { media: img("board-test", "Thermal image of the assembled monitor under load"), caption: "Thermal imaging at worst case confirmed the zone separation." },
    ],
    bodyHtml: `
<h3>Why self-heating dominated the design</h3>
<p>An NDIR CO₂ sensor compensates against temperature, so an error in the temperature reading propagates directly into the gas reading. A 2.6&nbsp;°C offset was producing roughly 40&nbsp;ppm of CO₂ error — enough to trigger ventilation in an empty room.</p>
<h3>Zoning the board</h3>
<p>The six-layer stack-up gave us a continuous ground reference for the radio while allowing a deliberate discontinuity under the sensor tab. Heat travels through copper far more readily than through FR-4, so the neck carries only the four signals the sensor needs, on 0.15&nbsp;mm tracks, with no pour.</p>
<h3>Firmware that respects the physics</h3>
<p>Rather than correcting in software, the sampling schedule avoids the problem: the lamp fires, the radio stays quiet, and the temperature sample is taken once the local gradient has settled. The correction table that the previous product depended on was deleted.</p>`.trim(),
  },

  {
    id: "prj-health",
    slug: "portable-health-device",
    title: "Portable Health Monitoring Device",
    summary:
      "A wrist-worn continuous vitals monitor with a Type BF applied part, seven-day battery life and BLE upload to a clinician dashboard.",
    year: 2025,
    clientName: null,
    isConfidential: true,
    cover: img("proj-health-wearable", "Wrist-worn health monitoring device with a colour display"),
    industry: { slug: "medical-devices", name: "Medical Devices" },
    services: [
      svc("circuit-and-schematic-design"),
      svc("embedded-systems-and-firmware"),
      svc("test-and-compliance"),
    ],
    durationWeeks: 26,
    featured: true,
    orderIndex: 2,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Portable Health Monitoring Device — Case Study",
    seoDescription:
      "IEC 60601-1 Type BF wearable vitals monitor: analog front-end noise reduction, seven-day battery life and IEC 62304 Class B firmware.",
    boardSpec: {
      layers: 8,
      sizeMm: [32, 24],
      componentCount: 186,
      ipcClass: "Class 2",
      stackup: "0.8 mm HDI, 1+N+1 microvia, ENIG, via-in-pad filled and capped",
    },
    challenge:
      "The analog front end needed a 20 µVpp noise floor to resolve the PPG signal at low perfusion, on a board 32 mm across that also carried a BLE radio, a buck-boost converter and a colour display. The first-pass prototype from a previous supplier measured 140 µVpp and could not hold a reading during movement.",
    approach:
      "The AFE was moved onto its own quiet island with a dedicated low-noise LDO fed from the switcher, and the display and radio were placed on the opposite side of an eight-layer HDI stack-up with a solid ground layer between them. The buck-boost switching frequency was moved to 2.2 MHz and synchronised to the AFE conversion clock so its residual sits outside the measurement band. Firmware gates the radio so no transmission occurs during a conversion window.",
    outcome:
      "Measured noise floor came in at 18 µVpp, inside the target. Battery life reached seven days against a five-day requirement. IEC 62304 Class B documentation was produced alongside the firmware, and the device cleared IEC 60601-1-2 immunity testing without modification.",
    metrics: [
      { label: "AFE noise floor", value: "140 → 18", unit: "µVpp" },
      { label: "Battery life", value: "7", unit: "days" },
      { label: "Board area", value: "32 × 24", unit: "mm" },
      { label: "Immunity retest", value: "0", unit: "cycles" },
    ],
    gallery: [
      { media: img("board-embedded", "HDI board with the analog front end island visible"), caption: "The AFE island, separated from the radio by a solid reference layer." },
    ],
    bodyHtml: `
<h3>Noise as a system budget</h3>
<p>We allocated the 20&nbsp;µVpp target across contributors before layout: LDO output noise, conversion clock jitter, switching residual and radio coupling each received a share. That made the design decisions arithmetic rather than argument.</p>
<h3>Synchronisation instead of suppression</h3>
<p>Filtering a switching residual out of a PPG band costs area and settling time. Moving the converter to 2.2&nbsp;MHz and locking it to the conversion clock puts the residual where it does no harm — a firmware and clocking decision that saved four passive components and a millimetre of height.</p>
<h3>Isolation and applied-part classification</h3>
<p>The Type&nbsp;BF classification set creepage and clearance requirements at the electrode interface which fixed the connector position and the keep-out geometry before routing began.</p>`.trim(),
  },

  {
    id: "prj-gateway",
    slug: "industrial-controller",
    title: "Industrial Controller & Protocol Gateway",
    summary:
      "A DIN-rail controller bridging Modbus RTU, CANopen and EtherNet/IP with a 9–36 V input and 4 kV surge immunity on every port.",
    year: 2024,
    clientName: "Kessler Automation",
    isConfidential: false,
    cover: img("proj-industrial-gateway", "DIN-rail mounted industrial controller with multiple port connectors"),
    industry: { slug: "industrial-and-iiot", name: "Industrial & IIoT" },
    services: [
      svc("pcb-layout-and-high-speed-design"),
      svc("embedded-systems-and-firmware"),
      svc("manufacturing-support"),
    ],
    durationWeeks: 22,
    featured: true,
    orderIndex: 3,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Industrial Controller & Protocol Gateway — Case Study",
    seoDescription:
      "DIN-rail industrial gateway with isolated Modbus, CANopen and EtherNet/IP ports, 4 kV surge immunity and a 31 % BOM cost reduction.",
    boardSpec: {
      layers: 6,
      sizeMm: [98, 76],
      componentCount: 340,
      ipcClass: "Class 2",
      stackup: "1.6 mm FR-4 Tg170, 2 oz outer, 35 µm inner, HASL lead-free",
    },
    challenge:
      "Five isolated ports on one board, each requiring 4 kV surge immunity, inside a 22.5 mm DIN enclosure with no forced airflow. The client's existing product used four separate isolated DC-DC modules and could not hold its price point at the volume they had won.",
    approach:
      "We consolidated four isolated supplies into a single multi-output flyback with independent post-regulation, which removed three modules and their footprints. Surge protection was designed per port with a coordinated TVS and gas-discharge arrangement rather than an identical circuit repeated five times, sized against each port's actual exposure. Two-ounce outer copper and a via field under the flyback carried the heat into the DIN rail bracket, avoiding a heatsink.",
    outcome:
      "BOM cost fell 31 % and part count by 46 lines. All five ports passed IEC 61000-4-5 at 4 kV line-to-earth. Sustained thermal testing at 60 °C ambient showed a 21 °C rise at the hottest component, leaving comfortable derating margin.",
    metrics: [
      { label: "BOM cost", value: "−31", unit: "%" },
      { label: "BOM line count", value: "−46", unit: "lines" },
      { label: "Surge immunity", value: "4", unit: "kV" },
      { label: "Temperature rise", value: "21", unit: "°C" },
    ],
    gallery: [
      { media: img("board-manufacturing", "Panelised controller boards after reflow"), caption: "Four-up panel with V-score and tooling rails for the assembler." },
    ],
    bodyHtml: `
<h3>Consolidation without losing isolation</h3>
<p>Four isolated modules exist because they are easy, not because they are right. A single multi-output flyback with a properly designed transformer and independent post-regulation gave the same isolation with a third of the footprint — at the cost of a transformer specification that had to be got right first time.</p>
<h3>Surge protection sized per port</h3>
<p>Copying one protection circuit five times over-protects some ports and under-protects others. We assessed each port's exposure separately and coordinated the TVS and arrester clamping so energy is shared correctly during a strike.</p>
<h3>Thermal path through the mechanics</h3>
<p>With no airflow available, the DIN bracket became the heatsink. Two-ounce copper and a dense via field under the switch move heat into the bracket, which is why the assembly runs 21&nbsp;°C over ambient rather than needing a fan the enclosure cannot accommodate.</p>`.trim(),
  },

  {
    id: "prj-ev",
    slug: "ev-charging-module",
    title: "EV Charging Control Module",
    summary:
      "A 22 kW AC charge controller with residual current detection, PLC communication and grid-code compliant load management.",
    year: 2024,
    clientName: "Voltix Mobility",
    isConfidential: false,
    cover: img("proj-ev-charger", "EV charging module with a cable and status indicator ring"),
    industry: { slug: "energy-and-power", name: "Energy & Power" },
    services: [
      svc("circuit-and-schematic-design"),
      svc("pcb-layout-and-high-speed-design"),
      svc("test-and-compliance"),
    ],
    durationWeeks: 30,
    featured: true,
    orderIndex: 4,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "EV Charging Control Module — Case Study",
    seoDescription:
      "22 kW AC charge controller with 6 mA DC residual current detection, ISO 15118 PLC and IEC 62955 compliance, passing EMC first time.",
    boardSpec: {
      layers: 4,
      sizeMm: [140, 90],
      componentCount: 268,
      ipcClass: "Class 2",
      stackup: "2.0 mm FR-4 Tg170, 2 oz outer, reinforced isolation slots",
    },
    challenge:
      "Detecting 6 mA of DC residual current per IEC 62955 while sitting beside three 32 A conductors carrying switching noise, and running ISO 15118 power-line communication over the same cable. Two earlier prototypes had produced nuisance trips at roughly one per fourteen days.",
    approach:
      "The residual current sensor was moved to a fluxgate type with a differential drive and given its own shielded compartment with a slotted, guarded ground. The PLC coupling network was redesigned with a common-mode choke and the injection point relocated away from the sensor aperture. Firmware added a coherent averaging window synchronised to the mains cycle so switching transients, which are not mains-coherent, average out rather than accumulating.",
    outcome:
      "Nuisance trips fell to zero across a 90-day field trial on twelve units. The module met IEC 62955 6 mA DC detection with margin and passed EN 61851-21-2 EMC on the first attempt. It has since shipped in three of the client's product lines.",
    metrics: [
      { label: "Nuisance trips", value: "0", unit: "in 90 days" },
      { label: "DC residual detection", value: "6", unit: "mA" },
      { label: "EMC attempts", value: "1", unit: null },
      { label: "Product lines shipped", value: "3", unit: null },
    ],
    gallery: [
      { media: img("board-test", "Charge controller under EMC pre-compliance test"), caption: "Pre-compliance probing on revision A found the coupling path early." },
    ],
    bodyHtml: `
<h3>The trip was a measurement problem, not a threshold problem</h3>
<p>Raising the trip threshold would have failed the standard. The real issue was that switching transients were being integrated as though they were residual current. Synchronising the averaging window to the mains cycle discriminates between the two without touching sensitivity.</p>
<h3>Shielding the sensor properly</h3>
<p>A fluxgate sensor is only as good as its magnetic environment. Its own compartment, a guarded slot in the ground plane and a relocated PLC injection point removed the coupling that the previous revisions had been fighting in firmware.</p>`.trim(),
  },

  {
    id: "prj-motor",
    slug: "high-efficiency-motor-drive",
    title: "High-Efficiency GaN Motor Drive",
    summary:
      "A 3 kW three-phase servo drive using GaN half-bridges, reaching 97.4 % peak efficiency in a 40 % smaller envelope.",
    year: 2023,
    clientName: "Nexora Robotics",
    isConfidential: false,
    cover: img("proj-motor-drive", "Compact three-phase motor drive with heatsink and power connectors"),
    industry: { slug: "automotive-and-ev", name: "Automotive & EV" },
    services: [
      svc("circuit-and-schematic-design"),
      svc("pcb-layout-and-high-speed-design"),
      svc("prototyping-and-bring-up"),
    ],
    durationWeeks: 24,
    featured: false,
    orderIndex: 5,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "High-Efficiency GaN Motor Drive — Case Study",
    seoDescription:
      "3 kW GaN three-phase servo drive: 97.4 % peak efficiency, minimised commutation loops, and CISPR 25 Class 3 conducted emissions.",
    boardSpec: {
      layers: 6,
      sizeMm: [110, 84],
      componentCount: 292,
      ipcClass: "Class 2",
      stackup: "1.6 mm FR-4, 2 oz outer with 3 oz plated power layers, IMS heat path",
    },
    challenge:
      "Replacing a silicon IGBT drive with GaN to reach the efficiency and size targets, without the gate ringing and common-mode noise that had made two earlier in-house attempts unusable above 60 kHz.",
    approach:
      "Commutation loop inductance was the design target from the first placement study. Half-bridges were laid out with vertical loops through the stack rather than lateral ones, giving roughly 1.8 nH of loop inductance. Gate loops were kept under 4 mm with the driver returned to the source sense pin, and a Kelvin connection separated gate return from power return. Current sensing moved to shunts with a dedicated differential path away from the switching node.",
    outcome:
      "The drive runs at 100 kHz with 97.4 % peak efficiency and gate ringing under 1.2 V overshoot. Volume fell 40 % against the outgoing IGBT design, and conducted emissions met CISPR 25 Class 3 with the filter originally budgeted.",
    metrics: [
      { label: "Peak efficiency", value: "97.4", unit: "%" },
      { label: "Volume", value: "−40", unit: "%" },
      { label: "Loop inductance", value: "1.8", unit: "nH" },
      { label: "Switching frequency", value: "100", unit: "kHz" },
    ],
    gallery: [],
    bodyHtml: `
<h3>Loop inductance is the whole game</h3>
<p>GaN switches fast enough that a few nanohenries of commutation loop turns into tens of volts of overshoot. Routing the loop vertically through the stack-up, rather than around the board, is what makes 100&nbsp;kHz operation calm rather than marginal.</p>
<h3>Kelvin returns everywhere they matter</h3>
<p>Separating gate return from power return removes the source inductance from the gate loop. Without it, the device turns itself partially back on during a fast transition — the mechanism behind both earlier attempts.</p>`.trim(),
  },

  {
    id: "prj-agri",
    slug: "soil-sensing-node",
    title: "Multi-Depth Soil Sensing Node",
    summary:
      "A solar-assisted LoRaWAN soil probe measuring moisture and temperature at four depths, with a five-year field life.",
    year: 2023,
    clientName: "Bluente Agritech",
    isConfidential: false,
    cover: img("proj-agri-sensor", "Soil sensing node with probe stakes and a small solar panel"),
    industry: { slug: "agritech", name: "Agritech" },
    services: [
      svc("embedded-systems-and-firmware"),
      svc("circuit-and-schematic-design"),
      svc("prototyping-and-bring-up"),
    ],
    durationWeeks: 16,
    featured: false,
    orderIndex: 6,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    seoTitle: "Multi-Depth Soil Sensing Node — Case Study",
    seoDescription:
      "LoRaWAN soil moisture node with 3.1 µA sleep current, solar assist and a projected five-year field life in sealed IP68 housing.",
    boardSpec: {
      layers: 4,
      sizeMm: [46, 46],
      componentCount: 98,
      ipcClass: "Class 2",
      stackup: "1.0 mm FR-4, 1 oz, ENIG, conformal coated",
    },
    challenge:
      "A five-year life on a single primary cell with solar assist, in a sealed housing, reporting four sensor depths every fifteen minutes over LoRaWAN. The client's existing node managed fourteen months.",
    approach:
      "We audited every leakage path on the previous design and found 62 µA of the 78 µA sleep current came from three sources: a permanently biased sensor divider, an unnecessary pull-up on an I²C bus that was powered down, and a regulator with poor quiescent behaviour at light load. Sensors were switched through a load switch, the bus was properly isolated, and the regulator was replaced. The radio duty cycle was recalculated against the real reporting requirement, and unconfirmed uplinks were adopted with periodic confirmation rather than per-message acknowledgement.",
    outcome:
      "Sleep current fell from 78 µA to 3.1 µA. With the solar assist contributing, projected field life exceeds five years against the fourteen months previously achieved. Thirty units have now run two full seasons without a battery change.",
    metrics: [
      { label: "Sleep current", value: "78 → 3.1", unit: "µA" },
      { label: "Projected field life", value: "5+", unit: "years" },
      { label: "Reporting interval", value: "15", unit: "min" },
      { label: "Units in field trial", value: "30", unit: null },
    ],
    gallery: [],
    bodyHtml: `
<h3>Sleep current is found, not designed</h3>
<p>Nobody sets out to leave a sensor divider biased. These paths accumulate, and the only way to remove them is to measure the board section by section with everything else powered down. The audit took two days and returned four years of field life.</p>
<h3>Protocol choices are power choices</h3>
<p>Confirmed LoRaWAN uplinks on every message double the radio energy and can triple it when the gateway is marginal. Periodic confirmation gives the same delivery assurance for a fraction of the budget.</p>`.trim(),
  },
];

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);
