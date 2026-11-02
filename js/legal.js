/* Legal & risk: business legal profile, document templates, lawsuit-risk checklist with data-driven signals,
   signatures and incident log. Templates are starting points to be reviewed by a licensed attorney. */
(function (App) {
  const today = () => new Date().toISOString().slice(0, 10);
  const longDate = d => new Date((d || today()) + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  /* ---------- Legal profile (per business) ---------- */
  const PRACTICES = [
    ['website', 'We have a website'], ['onlineOrders', 'Online ordering / payments on our site'], ['reservations', 'Online reservations'],
    ['loyalty', 'Loyalty / rewards program'], ['email', 'Email marketing list'], ['sms', 'Text (SMS) marketing'],
    ['analytics', 'Website analytics or ad pixels (Google, Meta)'], ['wifi', 'Guest Wi-Fi'], ['cameras', 'Security cameras'],
    ['alcohol', 'We serve alcohol'], ['events', 'Events, classes or catering'], ['delivery', 'Our staff deliver (own vehicles)'],
    ['employees', 'We have employees'], ['contractors', 'We hire independent contractors'], ['tips', 'Tipped employees / tip pool'],
    ['minors', 'We employ workers under 18'], ['biometric', 'Fingerprint / face time clock']
  ];
  function profile() {
    const biz = App.biz.get(App.biz.current()) || {};
    const cs = App.compliance?.setup() || {};
    const d = { legalName: biz.name || '', dba: '', address: '', city: '', state: cs.state || '', zip: '', email: '', phone: '', website: '', effective: today(), owner: '',
      website: '', practices: { website: true, email: true, employees: !!cs.hasEmployees, contractors: true, tips: !!cs.tipped8027, alcohol: (biz.type === 'restaurant') } };
    const saved = App.bsettings.get('legal.profile', {});
    return { ...d, ...saved, practices: { ...d.practices, ...(saved.practices || {}) } };
  }
  const has = (p, k) => !!p.practices?.[k];

  /* ---------- Document templates (markdown; [BRACKETS] = fill in) ---------- */
  const B = s => s ? s : '[' + '___' + ']';
  function ctx(p) {
    const name = B(p.legalName), dba = p.dba ? ` d/b/a ${p.dba}` : '';
    const addr = [p.address, p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '[BUSINESS ADDRESS]';
    return { name, full: name + dba, brand: p.dba || p.legalName || '[BUSINESS NAME]', addr, email: p.email || '[CONTACT EMAIL]', phone: p.phone || '[PHONE]', site: p.website || '[WEBSITE URL]', state: p.state || '[STATE]', eff: longDate(p.effective) };
  }

  const DOCS = [
    { id: 'privacy', title: 'Website Privacy Policy', audience: 'Public: website / app', risk: 'Required by California (CalOPPA) for any site collecting personal info from Californians, by several other states, and by Google, Apple and Meta for ads and apps.', when: p => has(p, 'website'),
      body(p) { const c = ctx(p); const L = [];
        L.push(`# Privacy Policy`, `**Effective date:** ${c.eff}`, `This Privacy Policy explains how ${c.full} ("we," "us") collects, uses and shares information when you visit ${c.site}, order from us, or otherwise interact with us. By using our website or services you agree to this policy.`);
        L.push(`## Information we collect`, `- **Information you give us:** such as your name, email, phone number${has(p, 'onlineOrders') ? ', delivery address and order details' : ''}${has(p, 'reservations') ? ', reservation details (party size, date, special requests)' : ''}${has(p, 'loyalty') ? ', and loyalty-program activity' : ''}, and anything you send us (feedback, catering inquiries).`,
          `- **Payment information:** payments are processed by our payment providers. We do not store full card numbers.`,
          `- **Automatically collected:** device and browser type, IP address, pages viewed and approximate location${has(p, 'analytics') ? ', collected through cookies and similar technologies, including analytics and advertising tools (for example Google Analytics or the Meta Pixel)' : ''}.`,
          has(p, 'wifi') ? `- **Guest Wi-Fi:** if you use our Wi-Fi, we may collect your device identifier and the email you provide to connect.` : '',
          has(p, 'cameras') ? `- **Security cameras:** our premises use video surveillance for safety and loss prevention. Footage is kept for a limited time unless needed for an incident.` : '');
        L.push(`## How we use information`, `- To provide and confirm orders, reservations and services, and to contact you about them`, `- To run ${has(p, 'loyalty') ? 'our loyalty program and ' : ''}customer service`, has(p, 'email') || has(p, 'sms') ? `- To send marketing ${has(p, 'email') ? 'emails' : ''}${has(p, 'email') && has(p, 'sms') ? ' and ' : ''}${has(p, 'sms') ? 'text messages' : ''} **only if you opted in**. You can opt out at any time` : '', `- To improve our website and services, prevent fraud and keep our premises safe`, `- To comply with law and protect our rights`);
        L.push(`## How we share information`, `We do **not** sell your personal information. We share it only with service providers that help us operate (payment processing, online ordering and delivery platforms, reservations, email/text providers, website hosting${has(p, 'analytics') ? ', analytics and advertising' : ''}), when required by law, to protect safety or rights, or as part of a sale or transfer of the business.`);
        if (has(p, 'analytics')) L.push(`## Cookies and advertising`, `We and our partners use cookies to understand site use and to show relevant ads. You can control cookies in your browser settings and opt out of interest-based ads at optout.aboutads.info. Our site responds to Global Privacy Control signals as an opt-out of "sharing" where required by law.`);
        L.push(`## How long we keep it`, `We keep personal information only as long as needed for the purposes above, for our legitimate business records, or as required by law (for example, tax records).`,
          `## Security`, `We use reasonable administrative, technical and physical safeguards. No method of transmission or storage is completely secure.`,
          `## Children`, `Our website is not directed to children under 13, and we do not knowingly collect their personal information.`,
          `## Your choices and rights`, `- **Marketing:** unsubscribe using the link in any email${has(p, 'sms') ? ', or reply STOP to any text' : ''}.`, `- Depending on where you live (for example California, Colorado, Virginia and other states with privacy laws), you may have the right to know, access, correct or delete your personal information and to opt out of certain uses. Contact us using the details below; we will verify and respond as the law requires. We will not discriminate against you for exercising these rights.`, `- **California residents:** we do not sell personal information and do not knowingly share it for cross-context behavioral advertising except as described above.`,
          `## Changes`, `We may update this policy. The effective date above shows when it was last changed.`,
          `## Contact us`, `${c.full}, ${c.addr} · ${c.email} · ${c.phone}`);
        return L.filter(Boolean).join('\n\n'); } },

    { id: 'terms', title: 'Website Terms of Use', audience: 'Public: website / app', risk: 'Limits your liability for website use, sets the governing law and a dispute process, and covers ordering, pricing errors and allergens.', when: p => has(p, 'website'),
      body(p) { const c = ctx(p); return [`# Terms of Use`, `**Effective date:** ${c.eff}`,
        `These Terms govern your use of ${c.site} and services offered by ${c.full}. If you do not agree, do not use the site.`,
        `## Orders, pricing and availability`, `Menu items, prices, hours and availability may change without notice. We may refuse or cancel any order, including orders with pricing or listing errors, and will refund any amount charged for a cancelled order.`,
        `## Allergens and dietary information`, `Our kitchen handles common allergens including milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans and sesame. We cannot guarantee any item is free of allergens. Nutrition and ingredient information is approximate. Please tell us about allergies before ordering.`,
        has(p, 'loyalty') ? `## Rewards and gift cards\nRewards have no cash value, are non-transferable, and may be changed or ended at any time as permitted by law. Gift cards are subject to their own terms and applicable law.` : '',
        `## Acceptable use`, `Do not misuse the site, interfere with its operation, attempt unauthorized access, or post unlawful or infringing content.`,
        `## Intellectual property`, `The site's content, logos and trademarks belong to us or our licensors and may not be used without permission.`,
        `## Disclaimers`, `The site is provided "as is" without warranties of any kind to the fullest extent permitted by law.`,
        `## Limitation of liability`, `To the fullest extent permitted by law, ${c.name} is not liable for indirect, incidental, special or consequential damages arising from use of the site, and our total liability for any claim relating to the site will not exceed the amount you paid us in the transaction giving rise to the claim.`,
        `## Indemnity`, `You agree to indemnify us against claims arising from your misuse of the site or violation of these Terms.`,
        `## Governing law and disputes`, `These Terms are governed by the laws of the State of ${c.state}. Before filing any claim, you agree to contact us at ${c.email} and try to resolve it informally for 30 days. Any claim must be brought in the state or federal courts located in ${c.state}, except small-claims matters.`,
        `## Accessibility`, `We are committed to making our website accessible. If you have difficulty using any part of it, contact us at ${c.email} or ${c.phone} and we will assist you and work to fix the issue.`,
        `## Contact`, `${c.full}, ${c.addr} · ${c.email}`].filter(Boolean).join('\n\n'); } },

    { id: 'accessibility', title: 'Website Accessibility Statement', audience: 'Public: website / app', risk: 'ADA website lawsuits are rising fast and hit small restaurants. A statement and a way to request help show good faith (it does not replace actually fixing accessibility issues).', when: p => has(p, 'website'),
      body(p) { const c = ctx(p); return [`# Accessibility Statement`, `${c.brand} wants everyone to be able to use our website, including people with disabilities. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and review the site regularly.`,
        `## Need help?`, `If you have trouble accessing any part of our website, menu or online ordering, please contact us at **${c.phone}** or **${c.email}**. We will provide the information or service you need by another method, such as taking your order by phone, and work to fix the issue.`,
        `## Ongoing efforts`, `- Text alternatives for images and a text version of our menu`, `- Keyboard-navigable pages and sufficient color contrast`, `- Periodic testing with automated tools and assistive technology`,
        `*Last reviewed: ${c.eff}*`].join('\n\n'); } },

    { id: 'cookie', title: 'Cookie Banner & Notice', audience: 'Public: website / app', risk: 'Needed when you use analytics or ad pixels; some states require an opt-out for targeted advertising.', when: p => has(p, 'analytics'),
      body(p) { const c = ctx(p); return [`# Cookie Notice`, `## Banner text`, `> We use cookies to run our site, understand how it's used and show you relevant ads. You can accept, reject non-essential cookies, or change your choices anytime in "Cookie settings." See our Privacy Policy.`, `Buttons: **Accept all** · **Reject non-essential** · **Cookie settings**`,
        `## Cookie categories`, `- **Strictly necessary:** keep the site and checkout working (always on)`, `- **Analytics:** help us understand visits (e.g. Google Analytics)`, `- **Advertising:** measure ads and show relevant ads (e.g. Meta Pixel, Google Ads)`,
        `## Opt-out`, `Our site honors Global Privacy Control (GPC) browser signals as an opt-out of sale/sharing where required. Contact ${c.email} with questions.`].join('\n\n'); } },

    { id: 'sms', title: 'SMS Marketing Terms & Consent', audience: 'Customers', risk: 'Texting customers without proper written consent can cost $500–$1,500 per message under the TCPA. This sets up compliant opt-in language and STOP/HELP handling.', when: p => has(p, 'sms'),
      body(p) { const c = ctx(p); return [`# Text Message (SMS) Program Terms`,
        `## Opt-in language (show next to the phone field / sign-up)`, `> By checking this box and entering your phone number, you agree to receive recurring automated marketing text messages from ${c.brand} at the number provided. Consent is not a condition of purchase. Msg frequency varies. Msg & data rates may apply. Reply HELP for help and STOP to cancel. See our Terms and Privacy Policy.`,
        `**The checkbox must be unchecked by default.** Keep a record of each opt-in (date, time, phone number, source, the exact language shown).`,
        `## Program terms`, `- **Program:** ${c.brand} offers and updates. **Frequency:** varies (about [X] msgs/month).`, `- **Opt out:** reply **STOP** at any time. You'll get one confirmation text and no further messages.`, `- **Help:** reply **HELP** or contact ${c.email} / ${c.phone}.`, `- Message and data rates may apply. Carriers are not liable for delayed or undelivered messages.`, `- We do not sell or share your mobile number or opt-in data with third parties for their marketing.`,
        `## Internal rules`, `- Only text people who opted in through the form above. Never buy lists or text numbers collected for receipts or reservations unless they opted in to marketing.`, `- Honor STOP immediately in all systems. Send marketing texts only between 8 a.m. and 9 p.m. in the recipient's time zone (some states are stricter).`, `- Keep consent records for at least 5 years.`].join('\n\n'); } },

    { id: 'email', title: 'Email Marketing Sign-up & Footer', audience: 'Customers', risk: 'CAN-SPAM requires a working unsubscribe, a physical address and honest subject lines, with penalties per email.', when: p => has(p, 'email'),
      body(p) { const c = ctx(p); return [`# Email Marketing`,
        `## Sign-up language`, `> Join our list for news, specials and events from ${c.brand}. You can unsubscribe anytime. See our Privacy Policy.`,
        `## Required footer for every marketing email`, `> You're receiving this because you signed up at ${c.brand}. [Unsubscribe] · [Update preferences]\n> ${c.full}, ${c.addr}`,
        `## Rules`, `- Honor unsubscribes within 10 business days (most tools do it instantly). Never email people who unsubscribed.`, `- Subject lines and "From" names must not be misleading. Identify the message as an ad where required.`, `- Don't add people to the list just because they gave their email for a receipt or reservation unless they opted in.`].join('\n\n'); } },

    { id: 'contractor', title: 'Independent Contractor Agreement', audience: 'Contractors', sign: 'contractor', risk: 'Treating workers as contractors without a written agreement (and real independence) leads to misclassification claims for back wages, taxes and penalties. Also covers insurance and liability for work on your premises.', when: p => has(p, 'contractors'),
      body(p) { const c = ctx(p); return [`# Independent Contractor Agreement`,
        `This Agreement is between **${c.full}** ("Company"), ${c.addr}, and **[CONTRACTOR NAME / BUSINESS]** ("Contractor"), effective [DATE].`,
        `## 1. Services`, `Contractor will provide: [DESCRIBE SERVICES, e.g. hood and duct cleaning monthly]. Contractor controls the manner, means, methods and schedule of the work, consistent with deadlines and safety rules.`,
        `## 2. Payment`, `Company will pay [RATE / FLAT FEE] within [15] days of receiving an invoice. Contractor provides a completed **Form W-9** before the first payment. Company will issue Form 1099 as required by law.`,
        `## 3. Independent contractor status`, `Contractor is an independent business, not an employee. Contractor is responsible for its own taxes, insurance, licenses, tools and equipment, may provide services to others, and is not entitled to employee benefits. Nothing in this Agreement creates a partnership, joint venture or employment relationship.`,
        `## 4. Insurance`, `Contractor will maintain general liability insurance of at least $[1,000,000] per occurrence and, if it has employees, workers' compensation as required by law, and will provide certificates on request. [Company will be named as additional insured.]`,
        `## 5. Indemnification`, `Contractor will indemnify and hold Company harmless from claims, damages and costs arising from Contractor's negligence, willful misconduct, or breach of this Agreement, including injuries to Contractor's personnel.`,
        `## 6. Compliance and safety`, `Contractor will follow applicable laws, licensing requirements and Company's posted safety and food-safety rules while on the premises.`,
        `## 7. Confidentiality`, `Contractor will keep Company's non-public information (recipes, financials, customer and employee data, security codes) confidential during and after this Agreement.`,
        `## 8. Term and termination`, `This Agreement continues until ended by either party with [14] days' written notice, or immediately for material breach. Company pays for services performed through termination.`,
        `## 9. General`, `Governed by the laws of the State of ${c.state}. This is the entire agreement and may be changed only in writing signed by both parties.`,
        `**Company:** ________________________  Name/Title: ________________  Date: ________\n\n**Contractor:** ______________________  Name/Title: ________________  Date: ________`].join('\n\n'); } },

    { id: 'nda', title: 'Confidentiality Agreement (Employees & Partners)', audience: 'Employees', sign: 'employee', risk: 'Protects recipes, supplier pricing, financials and customer/employee data, and sets expectations about handling personal information.', when: () => true,
      body(p) { const c = ctx(p); return [`# Confidentiality Agreement`,
        `This Agreement is between **${c.full}** ("Company") and **[NAME]** ("Recipient"), effective [DATE].`,
        `## Confidential information`, `Non-public information about the Company, including recipes and preparation methods, supplier terms and pricing, financial results, business plans, customer lists and data, employee and personnel information, passwords and security procedures.`,
        `## Obligations`, `Recipient will use Confidential Information only for Company work, not disclose it to others, protect it with reasonable care, and return or delete it when asked or when the relationship ends. Customer and employee personal information may only be accessed as needed for the job.`,
        `## Exclusions`, `Information that is public through no fault of Recipient, already known to Recipient, or required to be disclosed by law (with prompt notice to Company where allowed).`,
        `## Protected rights`, `Nothing here prevents Recipient from discussing wages, hours or working conditions, reporting possible violations of law to a government agency, or making disclosures protected by whistleblower laws. Under the Defend Trade Secrets Act, an individual is immune from liability for disclosing a trade secret in confidence to a government official or attorney solely to report a suspected violation of law, or in a sealed court filing.`,
        `## Term`, `These obligations continue during the relationship and for [2] years after it ends (and for trade secrets, as long as they remain trade secrets). Governed by the laws of the State of ${c.state}.`,
        `**Company:** ________________________  Date: ________\n\n**Recipient:** ______________________  Date: ________`].join('\n\n'); } },

    { id: 'handbook-ack', title: 'Employee Handbook & Policies Acknowledgment', audience: 'Employees', sign: 'employee', risk: 'Signed acknowledgments are key evidence in harassment, wage, discipline and termination claims: they prove the employee knew the rules.', when: p => has(p, 'employees'),
      body(p) { const c = ctx(p); return [`# Employee Acknowledgment`,
        `I acknowledge that I received and read the ${c.brand} Employee Handbook and the policies listed below, had the chance to ask questions, and agree to follow them:`,
        `- Equal employment opportunity and **anti-harassment / anti-discrimination**, including how to report concerns (I can report to any manager or to ${c.email}), and the **no-retaliation** policy`,
        `- **Timekeeping and pay:** I must record all time worked accurately, including pre-shift and post-shift work. Off-the-clock work is not allowed. Overtime will be paid as required by law.`,
        has(p, 'tips') ? `- **Tips:** how tips and any tip pool are handled. Managers and owners do not keep employees' tips.` : '',
        `- **Meal and rest breaks** under ${c.state} law, and how to report a missed break`,
        `- Food safety and allergen procedures; workplace safety and **injury reporting** (report any injury to a manager immediately)`,
        has(p, 'alcohol') ? `- Responsible alcohol service: checking ID, refusing service to visibly intoxicated guests` : '',
        `- Confidentiality of customer and employee information; acceptable use of devices and social media`,
        `I understand that the handbook is not a contract, that my employment is **at will** (either I or the Company may end it at any time, with or without cause or notice, except where state law provides otherwise), and that policies may be updated with notice.`,
        `**Employee name:** ______________________  **Signature:** ______________________  **Date:** __________`].filter(Boolean).join('\n\n'); } },

    { id: 'employee-privacy', title: 'Employee Privacy Notice', audience: 'Employees', sign: 'employee', risk: 'Tells staff what personal data you collect (I-9s, payroll, schedules, cameras, time clocks) and why. Required in some states and important if you use biometrics or monitoring.', when: p => has(p, 'employees'),
      body(p) { const c = ctx(p); return [`# Employee & Applicant Privacy Notice`, `**Effective:** ${c.eff}`,
        `${c.full} collects the following information about applicants and employees for hiring, payroll, benefits, scheduling, safety, legal compliance and managing the employment relationship:`,
        `- Identifiers and contact details; Social Security number and work-authorization documents (Form I-9)`, `- Pay, tax withholding (W-4), bank details for direct deposit, time and attendance records`, `- Performance, training and certification records (e.g. food handler cards)`,
        has(p, 'cameras') ? `- Video from security cameras in work and public areas (never in restrooms or changing areas)` : '',
        has(p, 'biometric') ? `- **Biometric data** (fingerprint or face template) from our time clock, collected **only with your separate written consent**, used only for timekeeping, and destroyed within [1 year] after your employment ends or as required by law` : '',
        `- Emergency contacts and any information you choose to provide`,
        `We share it only with payroll, benefits and HR service providers, government agencies as required, and professional advisors. We do not sell employee information. We keep records as required by law (generally 3–7 years) and then securely delete them. Access is limited to people who need it, and records are stored securely.`,
        `Questions or requests: ${c.email}.`].filter(Boolean).join('\n\n'); } },

    { id: 'biometric', title: 'Biometric Time-Clock Consent', audience: 'Employees', sign: 'employee', risk: "Illinois BIPA and similar laws (Texas, Washington, others) allow large damages for collecting fingerprints/face scans without written consent and a retention policy.", when: p => has(p, 'biometric'),
      body(p) { const c = ctx(p); return [`# Biometric Information Consent`, `${c.full} uses a time clock that scans [fingerprints / face geometry] to create a template used only to verify your identity for timekeeping and prevent buddy-punching.`,
        `- We do not sell, lease, trade or profit from biometric data, and share it only with our time-clock vendor, [VENDOR], to operate the system.`, `- Templates are stored securely and **permanently destroyed** when the purpose is satisfied (when your employment ends) and in all cases within [1 year] of your last interaction, unless law requires otherwise.`, `- You may request an alternative clock-in method.`,
        `I have read this notice and **consent** to the collection, storage and use of my biometric information as described.`, `**Name:** ______________________  **Signature:** ______________________  **Date:** __________`].join('\n\n'); } },

    { id: 'waiver', title: 'Event / Class Liability Waiver', audience: 'Customers', sign: 'customer', risk: 'For cooking classes, tastings, private events and activities. Waivers are not enforceable for gross negligence in most states, but they reduce exposure and document informed participation.', when: p => has(p, 'events'),
      body(p) { const c = ctx(p); return [`# Release, Waiver & Assumption of Risk`, `Event / activity: [EVENT] on [DATE] at ${c.addr}`,
        `I voluntarily choose to participate. I understand the activity may involve risks including burns, cuts, slips and falls, allergic reactions and foodborne illness, and **I assume those risks**. I will follow staff instructions and safety rules and will tell staff about any food allergies or health conditions before participating.`,
        `To the fullest extent permitted by law, I **release ${c.name}** and its owners, employees and agents from claims for injury, illness, loss or damage arising from my participation, except claims caused by their gross negligence or willful misconduct. This release binds my heirs and assigns.`,
        `I consent to emergency medical treatment if needed, at my expense. I am 18 or older (or my parent/guardian signs below).`,
        `This waiver is governed by ${c.state} law. If any part is unenforceable, the rest remains in effect.`,
        `**Participant:** ______________________  **Signature:** ____________  **Date:** ______\n\n**Parent/guardian (if under 18):** ______________________  **Signature:** ____________`].join('\n\n'); } },

    { id: 'media', title: 'Photo & Video Release', audience: 'Customers', sign: 'customer', risk: 'Using a customer or employee photo in marketing without permission can violate right-of-publicity laws.', when: () => true,
      body(p) { const c = ctx(p); return [`# Photo & Video Release`, `I give ${c.full} permission to use photographs, video and audio of me taken on [DATE] at [LOCATION/EVENT], and my first name, in its marketing, website and social media, without payment. I understand I can withdraw this permission for future uses by writing to ${c.email}. Materials already published need not be removed.`,
        `**Name:** ______________________  **Signature:** ______________________  **Date:** __________`].join('\n\n'); } },

    { id: 'signage', title: 'Required Signs & Notices (Allergen, Cameras, Alcohol)', audience: 'Customers', risk: 'Posted notices reduce slip-and-fall, allergen, surveillance and dram-shop exposure, and are required for some items.', when: () => true,
      body(p) { const c = ctx(p); return [`# Signs & Notices to Post`,
        `## Menu / counter allergen notice`, `> Please tell your server about any food allergies before ordering. Our kitchen uses milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy and sesame, and we cannot guarantee any item is allergen-free.`,
        `## Consumer advisory (raw or undercooked foods)`, `> Consuming raw or undercooked meats, poultry, seafood, shellfish or eggs may increase your risk of foodborne illness.`,
        has(p, 'cameras') ? `## Video surveillance\n> This area is monitored by video cameras for safety and security. (Audio recording requires consent in many states. Do not record audio without legal advice.)` : '',
        has(p, 'alcohol') ? `## Alcohol\n> We check ID for anyone who appears under [40]. We reserve the right to refuse service. Please drink responsibly. Ask us to call you a ride.` : '',
        `## Wet floor / caution`, `Use "Caution: Wet Floor" signs whenever mopping or after spills, and log floor checks (see Incident log).`,
        `## Workplace posters`, `Federal and ${c.state} labor law posters (minimum wage, FLSA, OSHA, EEO, FMLA if 50+ employees, workers' comp, state-specific notices) must be displayed where employees can see them.`].filter(Boolean).join('\n\n'); } },

    { id: 'breach', title: 'Data Breach Response Plan', audience: 'Internal', risk: 'Every state has breach-notification deadlines. Having a plan avoids late notice (a common basis for penalties and lawsuits) after a hacked POS, laptop or email.', when: () => true,
      body(p) { const c = ctx(p); return [`# Data Breach Response Plan`, `**Owner of this plan:** ${p.owner || '[NAME]'} · **Last reviewed:** ${c.eff}`,
        `## What counts`, `Unauthorized access to customer or employee personal information: names with SSNs, driver's license, bank or card numbers, medical or biometric data, account logins. Examples: stolen laptop with personnel files, hacked POS or email, misdirected payroll file, ransomware.`,
        `## First 24 hours`, `1. **Contain:** disconnect affected devices from the network, change passwords, disable compromised accounts. Don't wipe devices (preserve evidence).`, `2. **Call:** your insurance carrier (cyber policy), your POS/payment processor if card data may be involved, and an attorney.`, `3. **Document:** what happened, when discovered, what data, how many people, actions taken (use the Incident log).`,
        `## Within days`, `4. Determine whose data was affected and their states of residence.`, `5. **Notify** affected individuals, and state attorneys general / regulators where required, within the deadlines in each state (often 30–60 days, some "without unreasonable delay"). Payment card breaches follow processor/PCI rules.`, `6. Offer credit monitoring if SSNs or financial data were exposed (some states require it).`,
        `## Prevent`, `- Turn on full-disk encryption (Windows BitLocker / Mac FileVault) and the app lock in Ops Command Desk.`, `- Use unique passwords and two-factor sign-in for email, POS, payroll and bank.`, `- Never store full card numbers. Use a PCI-compliant processor.`, `- Keep only the personal data you need and securely shred/delete it on schedule.`,
        `## Contacts`, `Insurance: [CARRIER / POLICY # / PHONE] · Attorney: [NAME / PHONE] · Payment processor: [NAME / PHONE] · IT help: [NAME / PHONE]`].join('\n\n'); } },

    { id: 'retention', title: 'Record Retention & Data Destruction Policy', audience: 'Internal', risk: 'Keeping data too long increases breach exposure; destroying it too early hurts you in audits and lawsuits. A written schedule protects both ways.', when: () => true,
      body(p) { const c = ctx(p); return [`# Record Retention & Destruction Policy`, `${c.full} keeps records for the periods below, then destroys them securely (cross-cut shredding for paper, secure deletion for files). **Suspend destruction** of anything related to an actual or threatened lawsuit, audit or investigation (a "litigation hold").`,
        `| Record | Keep for |\n|---|---|\n| Tax returns and supporting records | 7 years |\n| Payroll, timesheets, tip records, W-4s | 4+ years |\n| I-9 forms | 3 years after hire or 1 year after termination, whichever is later |\n| Personnel files, discipline, training | Employment + 4 years |\n| Incident reports, injury logs | 5 years (longer if a claim is open) |\n| Contracts, leases, licenses, insurance policies | Term + 6 years |\n| Customer marketing consents (SMS/email) | 5 years after last message |\n| Security camera footage | [30] days unless saved for an incident |\n| Receipts, invoices, bank statements | 7 years |`,
        `Review this schedule yearly with your accountant and attorney; state requirements vary.`].join('\n\n'); } }
  ];

  /* ---------- Lawsuit-risk checklist ---------- */
  /* sev: 3 high / 2 medium / 1 low. `when` = applicability; `auto` = data-driven answer {ans:true|false, note} */
  const Q = [
    // Insurance
    { id: 'gl', cat: 'Insurance', sev: 3, q: 'General liability insurance is active', why: 'Slip-and-falls and customer injuries are the most common restaurant claims.', lic: /general liability/i },
    { id: 'liquor', cat: 'Insurance', sev: 3, q: 'Liquor liability insurance is active', why: 'Dram-shop laws make you liable for injuries caused by guests you over-served. GL policies usually exclude this.', when: p => has(p, 'alcohol'), lic: /liquor liability/i },
    { id: 'wc', cat: 'Insurance', sev: 3, q: "Workers' compensation insurance is active", why: 'Required in nearly every state once you have employees. Being uninsured can mean penalties and personal liability for injuries.', when: p => has(p, 'employees'), lic: /workers'? ?comp/i },
    { id: 'epli', cat: 'Insurance', sev: 2, q: 'Employment practices liability (EPLI) coverage', why: 'Covers harassment, discrimination and wrongful-termination claims, which GL does not.', when: p => has(p, 'employees'), lic: /employment practices|epli/i },
    { id: 'cyber', cat: 'Insurance', sev: 2, q: 'Cyber liability coverage', why: 'Pays for breach response, notification and claims after a hacked POS, email or laptop.', lic: /cyber/i },
    { id: 'auto', cat: 'Insurance', sev: 2, q: 'Hired & non-owned auto coverage for staff deliveries', why: 'If an employee crashes while delivering in their own car, the business can be sued.', when: p => has(p, 'delivery'), lic: /non-owned|commercial auto/i },
    // Entity & money
    { id: 'entity', cat: 'Entity & money', sev: 3, q: 'The business is an LLC or corporation (not a sole proprietorship)', why: 'Without an entity, your personal home and savings are exposed to business lawsuits.' },
    { id: 'separate', cat: 'Entity & money', sev: 3, q: 'Business money is kept separate: no personal purchases on business accounts', why: 'Mixing personal and business funds ("commingling") lets a plaintiff "pierce the veil" and reach your personal assets.' },
    { id: 'annual', cat: 'Entity & money', sev: 2, q: 'State annual report / franchise tax is filed and the entity is in good standing', why: 'A lapsed entity can lose liability protection.' },
    { id: 'opagreement', cat: 'Entity & money', sev: 1, q: 'Signed operating agreement / bylaws', why: 'Shows the entity is run as a separate business; avoids partner disputes.' },
    // Employment
    { id: 'overtime', cat: 'Employment', sev: 3, q: 'Overtime is paid for all hours over 40 in a workweek (and daily OT where required)', why: 'Wage-and-hour class actions are among the costliest restaurant lawsuits.', when: p => has(p, 'employees') },
    { id: 'breaks', cat: 'Employment', sev: 2, q: 'Meal and rest breaks follow state law and are recorded', why: 'Missed-break premiums are a frequent claim in CA, WA, OR, NY and other states.', when: p => has(p, 'employees') },
    { id: 'tips', cat: 'Employment', sev: 3, q: 'Tip pool / tip credit follows the rules (no managers in the pool, written notice)', why: 'Tip violations drive many restaurant suits.', when: p => has(p, 'tips') },
    { id: 'i9', cat: 'Employment', sev: 2, q: 'Every employee has a completed I-9 (and W-4) on file', why: 'I-9 paperwork fines run per form.', when: p => has(p, 'employees') },
    { id: 'handbook', cat: 'Employment', sev: 2, q: 'Written handbook with signed acknowledgments (anti-harassment, timekeeping, breaks)', why: 'Your main defense in harassment and wage claims.', when: p => has(p, 'employees') },
    { id: 'harassment', cat: 'Employment', sev: 2, q: 'Harassment-prevention training completed where required (e.g. CA, NY, IL, CT, DE, ME)', why: 'Mandatory in several states; reduces liability everywhere.', when: p => has(p, 'employees') },
    { id: 'posters', cat: 'Employment', sev: 1, q: 'Federal and state labor-law posters are displayed', why: 'Required; missing posters can extend deadlines to sue.', when: p => has(p, 'employees') },
    { id: 'minors', cat: 'Employment', sev: 2, q: 'Minors have work permits and follow hour / equipment limits', why: 'Child-labor fines are steep (e.g. slicers, fryers, late hours).', when: p => has(p, 'minors') },
    { id: 'contractors', cat: 'Employment', sev: 2, q: 'Contractors have signed agreements, a W-9 and their own insurance', why: 'Protects against misclassification and injury claims from contractors.', when: p => has(p, 'contractors') },
    { id: 'biometric', cat: 'Employment', sev: 3, q: 'Written consent + retention policy for fingerprint/face time clocks', why: 'Biometric privacy laws (especially Illinois BIPA) allow large per-person damages.', when: p => has(p, 'biometric') },
    // Premises & customers
    { id: 'floors', cat: 'Premises & guests', sev: 2, q: 'Floor checks and wet-floor signs are used and logged', why: 'A documented inspection routine is the best defense to slip-and-fall claims.' },
    { id: 'allergen', cat: 'Premises & guests', sev: 2, q: 'Allergen notice posted and staff trained on allergy orders', why: 'Allergic reactions are a growing source of claims.' },
    { id: 'incidents', cat: 'Premises & guests', sev: 2, q: 'Incidents are written up the same day (photos, witnesses)', why: 'Claims arrive months later; notes made at the time win cases.' },
    { id: 'alcoholtrain', cat: 'Premises & guests', sev: 3, q: 'Alcohol servers are certified (TIPS / ServSafe Alcohol) and check ID', why: 'Training is a key defense under dram-shop laws and may be required.', when: p => has(p, 'alcohol') },
    { id: 'ada', cat: 'Premises & guests', sev: 2, q: 'Physical accessibility checked (entrance, restroom, counter height, parking)', why: 'ADA Title III premises suits are common and some states add damages.' },
    // Online & data
    { id: 'privacy', cat: 'Online & data', sev: 2, q: 'Privacy policy is posted on the website', why: "California's CalOPPA requires one for sites collecting info from Californians; ad platforms require it too.", when: p => has(p, 'website') },
    { id: 'webada', cat: 'Online & data', sev: 3, q: 'Website & online menu are accessible (WCAG 2.1 AA) with an accessibility statement', why: 'ADA website lawsuits are rising and frequently target small restaurants.', when: p => has(p, 'website') },
    { id: 'smsconsent', cat: 'Online & data', sev: 3, q: 'Texts go only to people who opted in, with STOP/HELP handling and saved consent records', why: 'TCPA damages are $500–$1,500 per text.', when: p => has(p, 'sms') },
    { id: 'emailrules', cat: 'Online & data', sev: 1, q: 'Marketing emails have unsubscribe + physical address', why: 'CAN-SPAM penalties apply per email.', when: p => has(p, 'email') },
    { id: 'pci', cat: 'Online & data', sev: 2, q: 'Card payments go through a PCI-compliant processor; no card numbers written down or stored', why: 'Card breaches bring processor fines and lawsuits.' },
    { id: 'encryption', cat: 'Online & data', sev: 2, q: 'This computer uses disk encryption (BitLocker / FileVault) and the app lock is on', why: 'A stolen laptop with personnel files is a reportable breach unless the data was encrypted.' },
    { id: 'breachplan', cat: 'Online & data', sev: 1, q: 'Data breach response plan written', why: 'State notification deadlines are short.' }
  ];

  /* Data-driven answers from what's already in the app */
  async function signals(p) {
    const out = {};
    const lic = App.bsettings.get('cmp.licenses', []);
    for (const q of Q.filter(q => q.lic)) {
      const m = lic.find(l => q.lic.test(l.name));
      if (m) { const st = App.compliance.licenseStatus(m); out[q.id] = { ans: st.k !== 'expired', note: `From your licenses: ${m.name} · ${st.label}` }; }
    }
    const cs = App.compliance?.setup() || {};
    out.entity = { ans: ['llc-single', 'partnership', 'scorp', 'ccorp'].includes(cs.entity), note: `Tax profile: ${App.compliance?.ENTITIES[cs.entity] || 'not set'}${cs.entity === 'partnership' ? ' (confirm it is an LLC, not a general partnership)' : ''}` };
    const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const ps = (await App.store.all('purchases')).filter(x => x.date >= yearAgo);
    const mixed = ps.filter(x => !/personal/i.test(x.payment || '') && (App.purchasing.totals(x).groups.excluded || 0) > 0);
    const ownerPaid = ps.filter(x => /personal/i.test(x.payment || ''));
    if (ps.length) out.separate = { ans: !mixed.length, note: mixed.length ? `${mixed.length} receipt${mixed.length > 1 ? 's' : ''} in the last 12 months had personal items paid with business funds (${App.fmt.money(App.sum(mixed.map(x => App.purchasing.totals(x).groups.excluded)), 2)}). Reimburse the business and buy personal items separately.${ownerPaid.length ? ` ${ownerPaid.length} business purchase${ownerPaid.length > 1 ? 's were' : ' was'} paid personally. Reimburse through payroll/expense reports.` : ''}` : `No personal items charged to business accounts in ${ps.length} receipts.${ownerPaid.length ? ` (${ownerPaid.length} owner-paid business purchases to reimburse.)` : ''}` };
    const ot = await overtimeCheck();
    if (ot) out.overtime = { ans: !ot.flagged.length, note: ot.flagged.length ? `${ot.flagged.length} employee-week${ot.flagged.length > 1 ? 's' : ''} over 40 hours with no overtime recorded (e.g. ${ot.flagged.slice(0, 2).map(f => `${f.emp}, week of ${f.week}: ${f.hours.toFixed(1)} hrs`).join('; ')}). Check against payroll.` : `Checked ${ot.weeks} employee-weeks in ${ot.source}: overtime recorded whenever hours exceeded 40.` };
    const emp = App.compliance && await (async () => { try { return (await App.compliance.readiness(new Date().getFullYear())).parts.find(x => /I-9/.test(x[0])); } catch { return null; } })();
    if (emp) out.i9 = { ans: emp[1] >= 1, note: `Personnel files: ${emp[2]} employees have an I-9 and W-4 attached` };
    const sig = App.bsettings.get('legal.signed', []);
    const cons = App.compliance ? (await App.compliance.contractors(new Date().getFullYear())).filter(c => c.needs) : [];
    if (cons.length) {
      const signed = cons.filter(c => sig.some(s => s.doc === 'contractor' && App.purchasing.norm(s.person) === c.key));
      out.contractors = { ans: signed.length === cons.length && cons.every(c => c.w9), note: `${signed.length} of ${cons.length} 1099 contractors have a signed agreement; ${cons.filter(c => c.w9).length} have a W-9` };
    }
    const docs = App.bsettings.get('legal.docs', {});
    if (docs['handbook-ack']) { const n = sig.filter(s => s.doc === 'handbook-ack').length; out.handbook = { ans: n > 0, note: `${n} signed handbook acknowledgment${n === 1 ? '' : 's'} recorded` }; }
    if (docs.breach) out.breachplan = { ans: true, note: 'Breach response plan saved in Documents' };
    out.encryption = { ans: App.lock?.enabled() ? null : false, note: App.lock?.enabled() ? 'App lock is on. Also confirm BitLocker/FileVault disk encryption.' : 'App lock is off (Settings → Security).' };
    if (out.encryption.ans === null) delete out.encryption.ans;
    const inc = App.bsettings.get('legal.incidents', []);
    if (inc.length) out.incidents = { ans: true, note: `${inc.length} incident${inc.length > 1 ? 's' : ''} logged` };
    return out;
  }

  /* Weekly hours per employee vs. recorded overtime (FLSA: >40 hrs in a workweek) */
  async function overtimeCheck() {
    for (const d of (await App.store.datasets()).filter(x => !x.live && ['operations', 'personnel'].includes(x.category))) {
      const emp = App.findCol(d.headers, ['employee', 'employee name', 'name']), eid = App.findCol(d.headers, ['employee id', 'emp id', 'employee number', 'badge']), date = App.findCol(d.headers, ['date', 'business date', 'shift date']);
      const hours = App.findCol(d.headers, ['total hours', 'actual hours', 'hours', 'regular hours']), ot = App.findCol(d.headers, ['overtime hours', 'overtime', 'ot hours']);
      if (!(emp && date && hours)) continue;
      const wk = {};
      for (const r of d.rows) {
        const dt = App.toDate(r[date]); if (!dt) continue;
        const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
        // Group by employee ID when available (two people can share a name)
        const k = (eid ? r[eid] : r[emp]) + '|' + mon.toISOString().slice(0, 10);
        const w = wk[k] = wk[k] || { emp: String(r[emp]), week: mon.toISOString().slice(0, 10), hours: 0, ot: 0 };
        w.hours += App.n0(r[hours]); w.ot += ot ? App.n0(r[ot]) : 0;
      }
      const all = Object.values(wk);
      return { source: d.name, weeks: all.length, flagged: all.filter(w => w.hours > 40.05 && w.ot < (w.hours - 40) - 0.05).sort((a, b) => b.hours - a.hours) };
    }
    return null;
  }

  async function assess() {
    const p = profile(), answers = App.bsettings.get('legal.answers', {}), sig = await signals(p);
    const items = Q.filter(q => !q.when || q.when(p)).map(q => {
      const a = answers[q.id];
      const s = sig[q.id];
      const ans = a !== undefined && a !== 'auto' ? a : (s && 'ans' in s ? (s.ans ? 'yes' : 'no') : (a === 'auto' ? undefined : a));
      return { ...q, ans: ans || '', auto: s, manual: a !== undefined && a !== 'auto' };
    });
    const scored = items.filter(i => i.ans === 'yes' || i.ans === 'no');
    const w = i => i.sev === 3 ? 3 : i.sev === 2 ? 2 : 1;
    const score = scored.length ? App.sum(scored.filter(i => i.ans === 'yes').map(w)) / App.sum(scored.map(w)) : NaN;
    const gaps = items.filter(i => i.ans === 'no').sort((a, b) => b.sev - a.sev);
    return { p, items, score, gaps, unanswered: items.filter(i => !i.ans).length };
  }

  App.legal = { PRACTICES, DOCS, Q, profile, has, assess, overtimeCheck, longDate };
})(window.App);
