import type { Service } from "@/types/app";
import { img } from "./media";

const now = "2026-06-01T09:00:00.000Z";

/**
 * Six service records covering the eleven capability areas:
 * circuit design · schematic design · PCB design · high-speed & multilayer ·
 * embedded systems · firmware · prototyping · testing · DFM/DFA ·
 * BOM optimisation · manufacturing support.
 */
export const services: Service[] = [
  {
    id: "svc-schematic",
    slug: "circuit-and-schematic-design",
    title: "Circuit & Schematic Design",
    tagline: "Architecture, topology and a schematic your manufacturer can read.",
    summary: "Clean, scalable and well documented schematics that form a solid foundation.",
    icon: "cpu",
    orderIndex: 1,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    heroImage: img("board-schematic", "Annotated schematic sheet showing a switching regulator stage"),
    seoTitle: "Circuit & Schematic Design Services",
    seoDescription:
      "Analog and mixed-signal circuit design, topology selection, worst-case analysis and manufacturable schematic capture in Altium and KiCad.",
    deliverables: [
      "System block diagram and power tree",
      "Hierarchical schematic set with a title block per sheet",
      "Component selection matrix with second sources",
      "Worst-case and tolerance analysis",
      "Simulation results (SPICE / LTspice)",
      "Design review pack and issue register",
    ],
    features: [
      {
        id: "f1",
        title: "Topology selection with the trade-offs written down",
        description:
          "Buck, boost, SEPIC, LDO or charge pump — chosen against efficiency at your real load profile, ripple budget, EMI headroom and board area, with the reasoning recorded so a later reviewer can follow it.",
        icon: "git-branch",
      },
      {
        id: "f2",
        title: "Analog and mixed-signal front ends",
        description:
          "Precision amplification, anti-alias filtering, current sensing, isolation barriers and ADC drive networks designed against a stated noise and accuracy budget rather than a reference design copied wholesale.",
        icon: "activity",
      },
      {
        id: "f3",
        title: "Power architecture and sequencing",
        description:
          "Complete power tree with efficiency at each rail, thermal headroom, inrush and sequencing logic, brown-out behaviour and the reset topology that keeps an MCU from latching in an undefined state.",
        icon: "zap",
      },
      {
        id: "f4",
        title: "Worst-case analysis before layout",
        description:
          "Tolerance stack-up, temperature coefficients and end-of-life drift checked against the specification, so a circuit that works on the bench still works at −40 °C on the thousandth unit.",
        icon: "sigma",
      },
      {
        id: "f5",
        title: "Schematics built for review, not just capture",
        description:
          "Signal flow left to right, power top to bottom, consistent reference designators, net labels that mean something, and every part carrying manufacturer part number, tolerance and voltage rating on the sheet.",
        icon: "file-text",
      },
      {
        id: "f6",
        title: "Second sources designed in from day one",
        description:
          "Critical parts carry an approved alternate with a footprint that accepts both. A single-source passive is a schedule risk we remove at schematic stage, not during a shortage.",
        icon: "layers",
      },
    ],
    tooling: [
      { label: "EDA", items: ["Altium Designer", "KiCad 8", "OrCAD Capture"] },
      { label: "Simulation", items: ["LTspice", "TINA-TI", "QSPICE", "Python control loop models"] },
      { label: "Standards", items: ["IPC-2221B", "IPC-7351B", "IEC 60950 / 62368-1 clearances"] },
    ],
    bodyHtml: `
<p>A schematic is the contract every later stage is held to. If the topology is wrong, no amount of careful layout rescues it; if the documentation is thin, the cost surfaces later as a bring-up problem, a compliance failure or a purchase order for the wrong part.</p>
<h3>How we approach a new circuit</h3>
<p>We start from your requirements rather than a reference design. Load profile, ambient range, efficiency target, noise budget, safety class and expected volume determine the topology — and we write down why each was chosen, so the decision survives a handover.</p>
<p>Power comes first. A complete power tree with per-rail efficiency, dissipation and sequencing tells us early whether the enclosure can shed the heat and whether the battery meets its runtime claim. It is far cheaper to find a 400&nbsp;mW problem here than after tooling.</p>
<h3>Analog gets the attention it needs</h3>
<p>Signal chains are designed against a stated budget: input-referred noise, gain error, drift over temperature and the ADC's real effective number of bits. We simulate the parts that warrant it — control loops, filter responses, start-up transients — and leave the rest to well-understood design rules.</p>
<h3>Documentation you can hand to anyone</h3>
<p>Every sheet carries a title block, a revision and a purpose. Nets are named for what they carry. Parts carry manufacturer part numbers, tolerances and voltage ratings on the face of the schematic, because the person reading it during a shortage is rarely the person who drew it.</p>
<p>You receive the source project, not just a PDF. The design is yours, in a format you can open without us.</p>`.trim(),
  },

  {
    id: "svc-pcb",
    slug: "pcb-layout-and-high-speed-design",
    title: "PCB Layout & High-Speed Design",
    tagline: "Controlled impedance, clean returns, manufacturable the first time.",
    summary: "High speed, high density PCBs designed with precision and reliability.",
    icon: "circuit-board",
    orderIndex: 2,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    heroImage: img("board-layout", "Multilayer PCB layout showing length-matched differential pairs"),
    seoTitle: "PCB Layout & High-Speed Multilayer Design",
    seoDescription:
      "Multilayer PCB layout, controlled-impedance stack-ups, DDR and gigabit routing, signal and power integrity analysis, EMC-aware design.",
    deliverables: [
      "Layer stack-up with impedance targets and the fabricator's build",
      "Placement study and mechanical fit review",
      "Routed board with length and skew matching report",
      "Signal and power integrity analysis",
      "Fabrication and assembly data (Gerber X2 / ODB++, IPC-2581)",
      "DRC, DFM and netlist verification reports",
    ],
    features: [
      {
        id: "f1",
        title: "Stack-ups designed with the fabricator, not guessed",
        description:
          "We agree the build with your fab house before routing: dielectric constants, prepreg and core selection, copper weights and finished thickness, so the 50 Ω on the drawing is the 50 Ω on the board.",
        icon: "layers",
      },
      {
        id: "f2",
        title: "Controlled impedance and length matching",
        description:
          "Single-ended and differential targets held to ±10 %, intra-pair skew inside 5 mils, inter-pair matching to the interface's budget. DDR3/DDR4 fly-by, USB 3.x, PCIe Gen3, MIPI, gigabit Ethernet and LVDS.",
        icon: "ruler",
      },
      {
        id: "f3",
        title: "Return paths treated as real signals",
        description:
          "Reference plane continuity checked across every layer transition, stitching vias placed at the transitions that need them, and split-plane crossings eliminated rather than tolerated. Most EMC failures start here.",
        icon: "waves",
      },
      {
        id: "f4",
        title: "Power delivery network analysis",
        description:
          "Target impedance derived from the transient current profile, decoupling chosen by measured mounted inductance rather than a rule of thumb, plane resonances checked, and DC drop simulated before fabrication.",
        icon: "battery-charging",
      },
      {
        id: "f5",
        title: "Thermal and mechanical co-design",
        description:
          "Copper pours and thermal vias sized against real dissipation, keep-outs and connector positions reconciled with the enclosure in 3D, and board outline exchanged with mechanical as STEP rather than a sketch.",
        icon: "thermometer",
      },
      {
        id: "f6",
        title: "HDI and dense assemblies",
        description:
          "Microvias, via-in-pad with filled and capped process, blind and buried structures, 0.4 mm pitch BGA fan-out and rigid-flex where the mechanics demand it — specified only when the density genuinely requires it.",
        icon: "grid-3x3",
      },
    ],
    tooling: [
      { label: "Layout", items: ["Altium Designer", "KiCad 8", "Allegro PCB Editor"] },
      { label: "Analysis", items: ["Polar Si9000 / Si8000", "HyperLynx SI/PI", "Saturn PCB Toolkit", "Ansys SIwave"] },
      { label: "Standards", items: ["IPC-2221B", "IPC-2222", "IPC-6012 Class 2/3", "IPC-A-600", "IPC-2581B"] },
    ],
    bodyHtml: `
<p>High-speed layout is where a design either becomes manufacturable or becomes a series of expensive respins. The difference is rarely one dramatic mistake — it is an accumulation of small compromises in the stack-up, the return paths and the placement.</p>
<h3>Placement is most of the work</h3>
<p>Before a single track is routed we settle placement: power stages away from sensitive analog, crystals close and quiet, connectors where the mechanics need them, and decoupling on the same side as the pin it serves. A board that places well routes quickly. A board that places badly never routes cleanly at any effort.</p>
<h3>The stack-up is a decision, not a default</h3>
<p>We agree the build with your fabricator first — dielectric materials, copper weights, prepreg and core thicknesses — and calculate impedance against that specific build. A four-layer board with an honest stack-up outperforms a six-layer board with an assumed one.</p>
<h3>Signal and power integrity, quantified</h3>
<p>Interfaces are routed to their published budgets and then verified: impedance profiles, crosstalk between aggressor and victim pairs, eye diagrams where the data rate warrants simulation, and a power delivery network checked against target impedance across frequency. DC drop is simulated so a 1.0&nbsp;V core rail arrives as 1.0&nbsp;V.</p>
<h3>EMC designed in, not chased later</h3>
<p>Continuous reference planes, controlled loop areas, filtered and guarded I/O, deliberate chassis-ground strategy and a shielding plan agreed with mechanical. Boards that follow these rules routinely pass radiated emissions on the first visit to the chamber — which is the single largest schedule risk we can remove for you.</p>`.trim(),
  },

  {
    id: "svc-embedded",
    slug: "embedded-systems-and-firmware",
    title: "Embedded Systems & Firmware",
    tagline: "Firmware that is testable, updatable and safe to ship.",
    summary: "Firmware and embedded solutions that bring intelligence to your product.",
    icon: "microchip",
    orderIndex: 3,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    heroImage: img("board-embedded", "Debug probe attached to a microcontroller development board"),
    seoTitle: "Embedded Systems & Firmware Development",
    seoDescription:
      "Bare-metal and RTOS firmware, secure boot, OTA update, BLE and industrial protocol stacks, driver development and hardware bring-up.",
    deliverables: [
      "Firmware architecture and module decomposition",
      "Board support package and peripheral drivers",
      "Application firmware with unit and integration tests",
      "Bootloader with signed over-the-air update",
      "Power profile and duty-cycle measurements",
      "Source, build system and CI pipeline",
    ],
    features: [
      {
        id: "f1",
        title: "Bare metal, RTOS or Zephyr — chosen deliberately",
        description:
          "A sensor node that sleeps 99 % of the time does not need a scheduler. A gateway juggling a radio, a filesystem and a display does. We pick against your real concurrency and power requirements and say why.",
        icon: "cpu",
      },
      {
        id: "f2",
        title: "Secure boot and signed OTA update",
        description:
          "Chain of trust from ROM, ECDSA-signed images, A/B partitions with automatic rollback on a failed health check, and an update path that survives a power cut mid-write. Shipping without this is shipping a product you cannot fix.",
        icon: "shield-check",
      },
      {
        id: "f3",
        title: "Connectivity that works outside the lab",
        description:
          "BLE 5.x including mesh, Wi-Fi, LoRaWAN, NB-IoT and LTE-M, plus Modbus RTU/TCP, CAN and CANopen, Ethernet/IP and MQTT with TLS. Reconnection, backoff and offline buffering designed as features rather than bolted on.",
        icon: "radio",
      },
      {
        id: "f4",
        title: "Low-power design measured, not estimated",
        description:
          "Duty cycles profiled on real hardware with a current analyser. We report average consumption and projected battery life against your usage model, and we show you the traces.",
        icon: "battery-low",
      },
      {
        id: "f5",
        title: "Testable by construction",
        description:
          "Hardware access sits behind interfaces so logic runs on the host under unit test. CI builds every commit, runs the test suite, checks static analysis and produces a flashable artefact — no more 'it built on my machine'.",
        icon: "flask-conical",
      },
      {
        id: "f6",
        title: "Bring-up and debug on your bench or ours",
        description:
          "First power-on, peripheral validation, protocol analysis and the fault-finding that follows. Logic analysers, oscilloscopes and JTAG/SWD traces — with a written record of what was found and how it was fixed.",
        icon: "bug",
      },
    ],
    tooling: [
      { label: "Silicon", items: ["STM32 (F/G/H/L/U)", "Nordic nRF52 / nRF53", "ESP32-S3 / C6", "NXP i.MX RT", "TI MSP430 / CC13xx", "Raspberry Pi RP2350"] },
      { label: "Stacks", items: ["Zephyr RTOS", "FreeRTOS", "Bare metal C11", "Embedded Rust", "MCUboot", "lwIP", "littlefs"] },
      { label: "Tooling", items: ["CMake + GCC ARM", "Segger J-Link / Ozone", "Saleae Logic", "Unity + Ceedling", "GitHub Actions"] },
    ],
    bodyHtml: `
<p>Firmware is the part of a product that keeps changing after launch. That single fact drives every architectural decision we make: if it cannot be tested, updated and diagnosed in the field, it is not finished.</p>
<h3>Architecture before code</h3>
<p>We separate hardware access, protocol handling and application logic so that the interesting behaviour can be exercised on a development machine at commit speed. Peripheral drivers sit behind narrow interfaces; the application above them is portable and testable.</p>
<h3>Updates are a first-class requirement</h3>
<p>Every connected product we ship carries a bootloader with image signing, dual-bank storage and automatic rollback. An update that bricks a fielded fleet is the most expensive possible failure, so the recovery path is designed and tested before the first feature is written.</p>
<h3>Power is a measurement, not a promise</h3>
<p>Battery life claims are validated on hardware with a current analyser across the full duty cycle — advertising interval, sensor wake, radio transmit and deep sleep. You receive the traces and the arithmetic, not a figure from a datasheet.</p>
<h3>Hardware and firmware developed together</h3>
<p>Because the same team designs the board, test points land where the debug actually needs them, pin assignments respect both the routing and the peripheral matrix, and bring-up starts the day boards arrive rather than a fortnight later.</p>`.trim(),
  },

  {
    id: "svc-prototyping",
    slug: "prototyping-and-bring-up",
    title: "Prototyping & Bring-Up",
    tagline: "From first article to a board you can trust on a bench.",
    summary: "Rapid prototyping and testing to validate ideas and reduce time to market.",
    icon: "box",
    orderIndex: 4,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    heroImage: img("board-proto", "Prototype board on a bench beside an oscilloscope and probes"),
    seoTitle: "Electronics Prototyping & Hardware Bring-Up",
    seoDescription:
      "Rapid prototype builds, first-article inspection, structured bring-up, characterisation against specification and iteration to a release candidate.",
    deliverables: [
      "Prototype build package and kitted BOM",
      "First-article inspection report",
      "Structured bring-up procedure and results",
      "Characterisation data against the specification",
      "Issue register with root cause and disposition",
      "Release-candidate revision and change log",
    ],
    features: [
      {
        id: "f1",
        title: "Build packages that survive contact with an assembler",
        description:
          "Complete fabrication and assembly data, a kitted BOM with real part numbers and reels, centroid and paste data, and an assembly drawing that answers the questions before they are asked by email.",
        icon: "package",
      },
      {
        id: "f2",
        title: "Bring-up as a written procedure",
        description:
          "Power rails verified in sequence at low current before the processor is allowed to run, then clocks, then reset, then each peripheral. Every step has an expected value and a recorded result.",
        icon: "list-checks",
      },
      {
        id: "f3",
        title: "Characterisation against the specification",
        description:
          "Efficiency curves, ripple, thermal images under load, sensor accuracy across the operating range, radio range and sensitivity, and current draw per mode. Measured, tabulated and compared with the target.",
        icon: "line-chart",
      },
      {
        id: "f4",
        title: "Fast, honest iteration",
        description:
          "Two to three prototype revisions is normal and healthy. We batch findings, prove the fix on reworked hardware where we can, and carry a change log that explains every difference between revisions.",
        icon: "refresh-cw",
      },
      {
        id: "f5",
        title: "Enclosure and mechanical fit checks",
        description:
          "3D-printed housings and board-level fit checks catch the connector that fouls a boss or the standoff that lands on a track, at a stage where moving it costs nothing.",
        icon: "boxes",
      },
      {
        id: "f6",
        title: "Pre-compliance early, not at the end",
        description:
          "Near-field probing and conducted emissions on the first prototype find the problems while the layout can still change, instead of during a booked chamber slot with tooling already committed.",
        icon: "radar",
      },
    ],
    tooling: [
      { label: "Build", items: ["Quick-turn 2–8 layer fabrication", "Prototype SMT assembly", "Manual rework to 0201 / BGA"] },
      { label: "Bench", items: ["4-channel 500 MHz scopes", "Current analysers", "Thermal camera", "Spectrum analyser", "Near-field probe set", "Programmable loads"] },
      { label: "Mechanical", items: ["FDM and SLA printing", "STEP exchange with mechanical CAD"] },
    ],
    bodyHtml: `
<p>Prototyping exists to answer questions, and the value of a prototype is measured by how many it answers per revision. A build that arrives without a bring-up plan usually answers one.</p>
<h3>Before boards arrive</h3>
<p>The bring-up procedure is written while the boards are in fabrication: what gets powered, in what order, at what current limit, and what each rail should read. Test points are already on the board because the same team laid it out.</p>
<h3>Power first, always</h3>
<p>Rails are brought up on a current-limited supply with the processor held in reset. A short found at 50&nbsp;mA is a curiosity; the same short found at full current is a scrapped board and a day lost.</p>
<h3>Characterise, do not just demonstrate</h3>
<p>A prototype that "works" tells you little. We measure against the specification across the operating range — temperature, supply tolerance, load — and report where the margin actually sits. That data is what makes the next revision the last one.</p>
<h3>Every finding recorded</h3>
<p>Issues get a number, a root cause, a proposed disposition and a decision. Nothing is fixed silently. When you take the design to manufacture, the register is the evidence that the remaining risks are known and accepted.</p>`.trim(),
  },

  {
    id: "svc-test",
    slug: "test-and-compliance",
    title: "Test & Compliance",
    tagline: "Get through the chamber the first time, and test at volume.",
    summary: "Design verification, EMC pre-compliance and production test that scales.",
    icon: "clipboard-check",
    orderIndex: 5,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    heroImage: img("board-test", "Board under test with probes attached in an EMC pre-compliance setup"),
    seoTitle: "Design Verification, EMC Pre-Compliance & Production Test",
    seoDescription:
      "Verification planning, EMC and safety pre-compliance, environmental testing, and functional test fixtures with traceability for volume production.",
    deliverables: [
      "Design verification plan and traceability matrix",
      "EMC pre-compliance report with mitigations",
      "Environmental and reliability test results",
      "Functional test fixture design and software",
      "Production test coverage and yield analysis",
      "Technical file support for certification",
    ],
    features: [
      {
        id: "f1",
        title: "Verification traced back to requirements",
        description:
          "Every requirement carries a test that proves it and a result that records it. When an auditor or a customer asks how you know, the matrix answers in one page.",
        icon: "table-2",
      },
      {
        id: "f2",
        title: "EMC pre-compliance before you book the chamber",
        description:
          "Radiated and conducted emissions, ESD, EFT and surge exercised in-house. Problems found here are layout changes; the same problems found at an accredited lab are a rebooked slot and a schedule slip.",
        icon: "radio-tower",
      },
      {
        id: "f3",
        title: "Environmental and reliability testing",
        description:
          "Temperature cycling, humidity, vibration and mechanical shock to the profile your market demands, plus HALT-style margin discovery where the application justifies finding the limits early.",
        icon: "thermometer-snowflake",
      },
      {
        id: "f4",
        title: "Functional test fixtures that scale",
        description:
          "Bed-of-nails or pogo-pin fixtures with guided operator flow, per-unit pass/fail records, serial number capture and calibration data written to the device — designed so a contract manufacturer can run them unattended.",
        icon: "cable",
      },
      {
        id: "f5",
        title: "Test coverage measured, not assumed",
        description:
          "We report what the fixture actually catches: net coverage, parametric limits and the failure modes it does not see, so the residual risk at your line is a number rather than an assumption.",
        icon: "target",
      },
      {
        id: "f6",
        title: "Support through certification",
        description:
          "Technical construction file inputs, test-house liaison, and the design changes that follow a finding. We stay engaged until the certificate is issued.",
        icon: "badge-check",
      },
    ],
    tooling: [
      { label: "EMC", items: ["Spectrum analyser + LISN", "Near-field probe set", "ESD simulator", "TEM cell"] },
      { label: "Environmental", items: ["Thermal chamber −40 to +125 °C", "Humidity chamber", "Vibration table"] },
      { label: "Standards", items: ["EN 55032 / 55035", "IEC 61000-4-2/-4/-5", "IEC 62368-1", "IEC 60601-1-2", "ISO 7637-2"] },
    ],
    bodyHtml: `
<p>Compliance failures are rarely surprises in hindsight. They are the predictable consequence of decisions made months earlier in the stack-up, the I/O filtering or the grounding strategy — and they are cheapest to fix while those things are still editable.</p>
<h3>Pre-compliance is a design activity</h3>
<p>We probe the first prototype rather than the release candidate. A 3&nbsp;dB margin problem found on revision A is a layout change; found on revision C it is tooling, inventory and a rebooked chamber slot.</p>
<h3>Verification with a paper trail</h3>
<p>Each requirement maps to a verification method, a procedure and a recorded result. This is unglamorous and it is exactly what a medical or industrial customer will ask to see.</p>
<h3>Production test designed for the line, not the bench</h3>
<p>A fixture that needs an engineer to interpret it does not belong in a factory. Ours give an unambiguous pass or fail, capture the serial number, write calibration constants, and log results in a form your quality team can query.</p>
<h3>Coverage stated honestly</h3>
<p>No functional test catches everything. We tell you what ours catches and what it does not, so you can decide where to spend the next increment of test effort.</p>`.trim(),
  },

  {
    id: "svc-manufacturing",
    slug: "manufacturing-support",
    title: "Manufacturing Support",
    tagline: "DFM, DFA, BOM optimisation and a transfer that actually transfers.",
    summary: "From BOM optimization to manufacturing support, we've got you covered.",
    icon: "factory",
    orderIndex: 6,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    heroImage: img("board-manufacturing", "Assembled boards in a panel after reflow on a production line"),
    seoTitle: "DFM, DFA, BOM Optimisation & Manufacturing Support",
    seoDescription:
      "Design for manufacture and assembly review, BOM cost and risk optimisation, panelisation, CM selection and new product introduction support.",
    deliverables: [
      "DFM and DFA review report with severity ranking",
      "Optimised BOM with alternates and lifecycle status",
      "Panelisation and assembly drawing set",
      "Manufacturing data pack (IPC-2581 / ODB++)",
      "CM evaluation and quote comparison",
      "NPI support through first production run",
    ],
    features: [
      {
        id: "f1",
        title: "DFM review against your fabricator's real capability",
        description:
          "Annular ring, minimum trace and space, drill-to-copper, solder mask sliver and aspect ratio checked against the shop that will actually build it — not a generic rule set that either over-constrains or misses.",
        icon: "scan-line",
      },
      {
        id: "f2",
        title: "DFA that reduces assembly cost and defects",
        description:
          "Component orientation consistency, courtyard spacing, fiducial placement, thermal relief balance to prevent tombstoning, paste aperture design and rework access on the parts most likely to need it.",
        icon: "wrench",
      },
      {
        id: "f3",
        title: "BOM optimisation with the trade-offs shown",
        description:
          "Part consolidation across values and packages, tolerance relaxation where the circuit genuinely allows it, and lifecycle and lead-time risk flagged per line. Typical result on a mature design is a 15–35 % cost reduction.",
        icon: "receipt",
      },
      {
        id: "f4",
        title: "Supply-chain risk made visible",
        description:
          "Every line carries lifecycle status, sourcing count, lead time and an approved alternate where one exists. Single-sourced, NRND and long-lead parts are surfaced as a ranked list before they become an expedite fee.",
        icon: "truck",
      },
      {
        id: "f5",
        title: "Panelisation and process data",
        description:
          "Array layout with rails, tooling holes and fiducials, tab-route or V-score chosen for the depanel stress the board can take, and complete process data in IPC-2581 or ODB++ rather than a folder of loose Gerbers.",
        icon: "layout-grid",
      },
      {
        id: "f6",
        title: "Transfer that survives without us",
        description:
          "CM evaluation and quote comparison on like-for-like terms, first-article review, process window support during ramp, and documentation written so your manufacturer does not need to call the designer.",
        icon: "handshake",
      },
    ],
    tooling: [
      { label: "Data", items: ["IPC-2581B", "ODB++", "Gerber X2", "IPC-D-356 netlist"] },
      { label: "Analysis", items: ["Valor NPI-style DFM checks", "Silicon Expert / Octopart lifecycle data", "Cost roll-up modelling"] },
      { label: "Standards", items: ["IPC-A-610 Class 2/3", "IPC-J-STD-001", "IPC-7351B", "IPC-6012 Class 2/3"] },
    ],
    bodyHtml: `
<p>Design for manufacture is not a checklist run at the end. It is a set of constraints applied throughout, informed by the specific factory that will build the product.</p>
<h3>Reviewed against a real capability set</h3>
<p>Generic DFM rules either over-constrain a capable shop or miss the limits of a cheaper one. We review against your fabricator's published capability, so the feedback is actionable rather than theoretical.</p>
<h3>BOM optimisation, with the reasoning visible</h3>
<p>We consolidate part numbers, relax tolerances only where the analysis supports it, and identify where a slightly more expensive part removes an assembly step or a test failure mode. Every proposed change carries its saving and its risk, and you decide.</p>
<h3>Supply chain treated as a design input</h3>
<p>A design that cannot be sourced is not finished. Lifecycle status, sourcing breadth and lead time sit alongside price on every line, and critical parts carry a footprint-compatible alternate that has been checked, not assumed.</p>
<h3>Through to a stable first run</h3>
<p>We support first-article inspection, attend or review the first build, help tune the process window, and close out findings. The measure of a good transfer is that the second run needs us less than the first.</p>`.trim(),
  },
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);
