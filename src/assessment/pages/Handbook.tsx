import { useEffect, type ReactNode } from 'react';
import { CERTIFICATE_NOTE } from '../content';
import { Link, paths } from '../router';
import styles from './Handbook.module.css';

/**
 * Study handbook. Teaches the principles the assessment covers; the
 * revision questions here are deliberately different from the question bank.
 * The PDF in public/handbook/ is printed from this page (scripts/handbook-pdf).
 */

export const HANDBOOK_PDF = '/handbook/10x-customer-support-handbook.pdf';
export const HANDBOOK_EDITION = 'First edition, October 2026';

const CHAPTERS: [number, string][] = [
  [1, 'Customer support fundamentals'],
  [2, 'Active listening and empathy'],
  [3, 'Clear written and spoken communication'],
  [4, 'Handling complaints and de-escalation'],
  [5, 'Support channels and self-service'],
  [6, 'Tickets, prioritisation and SLAs'],
  [7, 'CRM, tools and documentation'],
  [8, 'Privacy, security and professional ethics'],
  [9, 'Service recovery and retention'],
  [10, 'Metrics and quality assurance'],
  [11, 'Escalation, teamwork and judgment'],
  [12, 'Difficult conversations, abuse and wellbeing'],
];

function Chapter({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section id={`chapter-${n}`} className={styles.chapter} aria-labelledby={`chapter-${n}-title`}>
      <p className={styles.chapterNo}>Chapter {n}</p>
      <h2 id={`chapter-${n}-title`} className="p-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <aside className={styles.key} aria-label="Key points">
      <p className={styles.boxLabel}>Key points</p>
      <ul>{children}</ul>
    </aside>
  );
}

function Scenario({ n, title, situation, children }: { n: number; title: string; situation: ReactNode; children: ReactNode }) {
  return (
    <aside className={styles.scenario} aria-label={`Scenario ${n}: ${title}`}>
      <p className={styles.boxLabel}>
        Scenario {n} · {title}
      </p>
      <p className={styles.situation}>{situation}</p>
      <div className={styles.approach}>{children}</div>
    </aside>
  );
}

function Revision({ items }: { items: [string, string][] }) {
  return (
    <div className={styles.revision}>
      <p className={styles.boxLabel}>Check your understanding</p>
      <ol>
        {items.map(([q, a]) => (
          <li key={q}>
            <p>{q}</p>
            <details>
              <summary>Suggested answer</summary>
              <p>{a}</p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

const GLOSSARY: [string, string][] = [
  ['Acknowledgement', 'Showing the customer you have understood what they said and how it has affected them, before moving to a solution.'],
  ['Active listening', 'Giving full attention, checking understanding by summarising, and asking questions that move the conversation forward.'],
  ['Backlog', 'All open tickets waiting for action. A growing backlog is an early warning that demand exceeds capacity.'],
  ['Churn', 'Customers who stop buying or cancel. Churn rate is the share lost over a period.'],
  ['CRM', 'Customer relationship management system: the record of a customer’s details, history and interactions.'],
  ['CSAT', 'Customer satisfaction score, usually from a short survey after an interaction (“How satisfied were you?”).'],
  ['CES', 'Customer effort score: how easy the customer found it to get their issue dealt with.'],
  ['Data minimisation', 'Collecting and showing only the personal data needed for the task in hand.'],
  ['De-escalation', 'Lowering the emotional temperature of a conversation so that the problem can be worked on.'],
  ['Escalation', 'Passing a case to someone with more authority (hierarchical) or more specialist skill (functional), with a full handover.'],
  ['First contact resolution (FCR)', 'The share of issues fully resolved in the customer’s first contact, with no follow-up needed.'],
  ['First response time', 'How long a customer waits for the first human reply. It is not the same as resolution time.'],
  ['Handover', 'The written summary given when a case moves to another person or team, so the customer does not have to repeat themselves.'],
  ['Internal note', 'A note on a ticket visible only to staff, used to record facts, actions and context.'],
  ['Knowledge base', 'A library of articles for customers (external) or staff (internal) that answer common questions.'],
  ['Macro', 'A saved reply or set of actions used for common requests. Always personalised before sending.'],
  ['NPS', 'Net Promoter Score: how likely customers are to recommend the company, measuring overall loyalty rather than one interaction.'],
  ['Omnichannel', 'Support across several channels (email, chat, phone, social) with one shared customer history.'],
  ['Ownership', 'Taking responsibility for seeing a customer’s issue through, even when others do part of the work.'],
  ['Personal data', 'Any information that identifies a person, such as name, email, phone number, address or account number.'],
  ['Priority', 'How soon a ticket should be worked on, based on impact and urgency together.'],
  ['Proactive support', 'Contacting customers about an issue before they contact you.'],
  ['Quality assurance (QA)', 'Reviewing a sample of interactions against an agreed standard to coach and improve.'],
  ['Reopen rate', 'The share of resolved tickets that customers reopen because the issue was not really fixed.'],
  ['Resolution time', 'The time from a ticket being opened until it is solved.'],
  ['Root cause', 'The underlying reason a problem happened, as opposed to its visible symptom.'],
  ['Self-service', 'Help customers can use without contacting an agent, such as FAQs, guides and account tools.'],
  ['Service recovery', 'What you do after a failure to put things right and restore the customer’s trust.'],
  ['Severity', 'How serious the impact of a problem is. Severity feeds into priority but is not the same thing.'],
  ['SLA', 'Service level agreement: a promised response or resolution time, such as “first reply within 4 business hours”.'],
  ['Social engineering', 'Manipulating staff into giving away information or access, for example by pretending to be the account holder.'],
  ['Ticket', 'A record of one customer issue, with its messages, status, owner and history.'],
  ['Triage', 'Sorting incoming tickets by priority and routing them to the right person or team.'],
  ['Verification', 'Confirming that you are speaking to the account holder before discussing or changing an account.'],
];

const CHECKLIST = [
  'Greet the customer and use their name if you have it.',
  'Read or listen to the whole message before replying.',
  'Acknowledge the impact on the customer in your own words.',
  'Confirm your understanding of the issue; ask focused questions to fill gaps.',
  'Check the customer history before asking them to repeat anything.',
  'Verify identity before discussing or changing account details.',
  'Ask only for the personal data you need, through the approved channel.',
  'Explain what you will do, what the customer needs to do, and when they will hear back.',
  'Promise only what you control; never guess at dates or outcomes.',
  'Escalate with a full handover when the issue is beyond your authority or skill.',
  'Record a clear internal note: issue, steps taken, outcome, next action.',
  'Confirm the fix with the customer before marking the ticket resolved.',
  'Follow up when you said you would, even if only to give an update.',
  'Report patterns and root causes, not just individual tickets.',
  'Stay professional and follow the abuse policy if a customer becomes abusive.',
];

export default function Handbook() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, []);

  return (
    <div className={`p-wrap ${styles.book}`}>
      <header className={styles.cover}>
        <p className="p-eyebrow">Study handbook</p>
        <h1 className="p-h1">Customer Support Professional Handbook</h1>
        <p className="p-lead">
          Everything covered by the 10X Customer Support Professional Assessment: principles, worked scenarios, revision questions, a
          glossary and a practice checklist.
        </p>
        <p className={`p-small p-muted ${styles.edition}`}>{HANDBOOK_EDITION} · 10X Marketing Solutions</p>
        <div className="p-row p-noprint" style={{ marginTop: 20 }}>
          <a className="p-btn" href={HANDBOOK_PDF} download>
            Download PDF
          </a>
          <Link className="p-btn p-btn--ghost" href={paths.home}>
            About the assessment
          </Link>
        </div>
      </header>

      <nav className={styles.toc} aria-label="Contents">
        <h2 className="p-h3">Contents</h2>
        <ol>
          <li>
            <a href="#how-to-use">How to use this handbook</a>
          </li>
          {CHAPTERS.map(([n, t]) => (
            <li key={n}>
              <a href={`#chapter-${n}`}>
                {n}. {t}
              </a>
            </li>
          ))}
          <li>
            <a href="#glossary">Glossary</a>
          </li>
          <li>
            <a href="#checklist">Practice checklist</a>
          </li>
        </ol>
      </nav>

      <section id="how-to-use" className={styles.chapter} aria-labelledby="how-to-use-title">
        <h2 id="how-to-use-title" className="p-h2">
          How to use this handbook
        </h2>
        <p>
          The assessment tests judgment as much as knowledge. About half of its questions describe a workplace situation and ask what you
          would do. The best answer is usually the one that is honest with the customer, protects their data, solves the real problem and
          leaves a clear record for colleagues.
        </p>
        <p>
          Read each chapter, then work through its scenario and revision questions without looking at the suggested answers. The revision
          questions are practice only; they are not the questions in the assessment.
        </p>
        <table className={styles.map}>
          <caption>How the assessment areas map to chapters</caption>
          <thead>
            <tr>
              <th scope="col">Assessment area</th>
              <th scope="col">Chapters</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Customer support fundamentals and customer experience</td><td>1, 5</td></tr>
            <tr><td>Communication, empathy and active listening</td><td>2, 3</td></tr>
            <tr><td>Complaint resolution and de-escalation</td><td>4, 12</td></tr>
            <tr><td>Ticket management, prioritisation and SLAs</td><td>6</td></tr>
            <tr><td>CRM, support tools and documentation</td><td>7</td></tr>
            <tr><td>Privacy, security, ethics and professional boundaries</td><td>8</td></tr>
            <tr><td>Service recovery and customer retention</td><td>9</td></tr>
            <tr><td>Support metrics and quality assurance</td><td>10</td></tr>
            <tr><td>Escalation, teamwork and situational judgment</td><td>11, 12</td></tr>
          </tbody>
        </table>
        <p className="p-small p-muted">{CERTIFICATE_NOTE}</p>
      </section>

      <Chapter n={1} title="Customer support fundamentals">
        <p>
          Customer support helps people who have a question or a problem with a product or service. Its job is to resolve that need
          accurately, quickly and in a way that leaves the customer confident in the business. Every contact is also a moment that shapes
          how the customer feels about the company as a whole: their <strong>customer experience</strong>.
        </p>
        <h3 className="p-h3">Support, service and success</h3>
        <p>
          The terms overlap, but they differ in timing and aim. <strong>Support</strong> is mostly <em>reactive</em>: the customer
          reaches out and you help. <strong>Customer success</strong> is <em>proactive</em> and long term: helping customers get lasting
          value so they stay. <strong>Customer service</strong> is the broad umbrella for every interaction a customer has with staff.
          Good support teams borrow from customer success by spotting patterns and acting before customers have to ask.
        </p>
        <h3 className="p-h3">Reactive and proactive support</h3>
        <p>
          Reactive support answers contacts as they arrive. Proactive support contacts customers first: warning about planned
          maintenance, telling affected customers about a known fault and its workaround, or reminding someone that a subscription is
          about to renew. Proactive messages reduce anxiety and inbound volume, but they must be accurate and specific.
        </p>
        <h3 className="p-h3">What customers actually want</h3>
        <ul className="p-list">
          <li>To be understood the first time, without repeating themselves.</li>
          <li>An accurate answer or a clear plan, not a fast but wrong one.</li>
          <li>Honesty about what will happen and when.</li>
          <li>Low effort: fewer steps, fewer transfers, fewer forms.</li>
          <li>To be treated with respect, whatever the problem.</li>
        </ul>
        <h3 className="p-h3">Ownership</h3>
        <p>
          Owning an issue means you treat it as yours until it is resolved or properly handed over. You may need help from billing or
          engineering, but you keep the customer informed and make sure nothing falls between teams. “That’s not my department” is never
          the end of a conversation; “Let me get this to the right team and update you by 3 pm” is.
        </p>
        <Key>
          <li>Support resolves needs; every contact also shapes the overall customer experience.</li>
          <li>Proactive communication prevents problems and reduces effort.</li>
          <li>Accuracy and honesty beat speed alone.</li>
          <li>Ownership means staying with the issue until it is resolved or handed over with full context.</li>
        </Key>
        <Scenario
          n={1}
          title="The known fault"
          situation="Your team learns that a payment-page bug has failed some customers’ card payments for two hours. It is fixed now, but about 300 customers were affected and only a few have contacted you."
        >
          <p>
            A reactive team waits for contacts. A better approach is proactive: agree the facts with the technical team, then message the
            affected customers. Say what happened in plain words, whether they were charged, what they need to do (if anything), and how
            to reach you. Give agents a short internal note so their answers match. This turns 300 possible complaints into a small
            number of simple follow-ups and shows customers you are honest.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Give one example of proactive support for an internet service provider.',
              'Telling customers in an area about planned engineering work in advance, with the expected times and what to do if service does not return.',
            ],
            [
              'Why might a fast first reply still produce a poor customer experience?',
              'If it is inaccurate, generic or does not address the real issue, the customer has to come back, which raises effort and frustration.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={2} title="Active listening and empathy">
        <p>
          Most support failures start with misunderstanding. Active listening is the discipline of making sure you have understood the
          customer’s problem, and how they feel about it, before you try to solve it.
        </p>
        <h3 className="p-h3">The habits of active listening</h3>
        <ul className="p-list">
          <li>
            <strong>Let the customer finish.</strong> Interrupting with a solution often solves the wrong problem.
          </li>
          <li>
            <strong>Summarise back.</strong> “So the order arrived on Monday, but the charger was missing, and you need it for work
            tomorrow. Is that right?”
          </li>
          <li>
            <strong>Ask focused questions.</strong> Open questions gather the story (“What happens when you try to log in?”). Closed
            questions confirm facts (“Are you using the mobile app or the website?”).
          </li>
          <li>
            <strong>Notice what is not said.</strong> A deadline, a previous contact or a worried tone tells you what matters most.
          </li>
          <li>
            <strong>Note the facts as you go,</strong> so you do not ask again.
          </li>
        </ul>
        <h3 className="p-h3">Empathy is not agreement</h3>
        <p>
          Empathy means recognising how the situation feels for the customer and showing it. It does not mean agreeing that they are right
          about everything, and it does not mean making promises. “I can see why that’s frustrating, especially with your trip on
          Friday” acknowledges the feeling; it does not concede blame or commit to a refund.
        </p>
        <p>
          Empathy that sounds scripted can make things worse. “I understand your frustration” repeated in every message reads as a formula.
          Refer to the customer’s actual situation instead.
        </p>
        <h3 className="p-h3">Vague problem reports</h3>
        <p>
          Customers often describe symptoms, not causes: “It doesn’t work.” Rather than guessing, ask one or two questions that narrow the
          problem: what they were trying to do, what happened instead, on which device, and since when. Keep the questions few and easy to
          answer.
        </p>
        <Key>
          <li>Understand before solving: let customers finish, then summarise back.</li>
          <li>Use open questions to explore and closed questions to confirm.</li>
          <li>Empathy acknowledges feelings without conceding blame or making promises.</li>
          <li>Specific empathy is credible; formulaic empathy is not.</li>
        </Key>
        <Scenario
          n={2}
          title="The rushed caller"
          situation="A caller starts: “I’ve been charged twice and I need this sorted now, I’m about to board a flight.”"
        >
          <p>
            The pressure is time. Acknowledge it and be efficient: “I’ll be quick so you can make your flight.” Confirm the essentials
            with closed questions (the account, the date and amount of the charges), check the account, and state the next step and when
            it will happen. If it cannot be resolved before boarding, agree how you will follow up (for example by email) so the customer
            does not need to call again.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Rewrite this reply to show empathy specific to the situation: “We apologise for any inconvenience.”',
              'For example: “I’m sorry the replacement still hasn’t arrived, especially as you needed it for your daughter’s birthday this weekend.”',
            ],
            [
              'What is the difference between an open and a closed question? When would you use each?',
              'Open questions invite explanation and are useful at the start to understand the situation. Closed questions get a specific fact and are useful to confirm details.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={3} title="Clear written and spoken communication">
        <p>
          Customers judge competence by how clearly you communicate. A correct answer buried in jargon or a wall of text still fails.
        </p>
        <h3 className="p-h3">Writing for support</h3>
        <ul className="p-list">
          <li>
            <strong>Lead with the answer.</strong> Put what the customer most needs to know first, then the detail.
          </li>
          <li>
            <strong>Use plain language.</strong> Replace internal terms (“your SKU was flagged by the OMS”) with everyday words (“our
            system stopped the order because the item was out of stock”).
          </li>
          <li>
            <strong>Keep steps numbered</strong> and one action per step.
          </li>
          <li>
            <strong>Be specific about time.</strong> “By 5 pm Thursday” is clearer than “soon” or “within the next few days”.
          </li>
          <li>
            <strong>Personalise templates.</strong> Saved replies save time, but always adapt them to the customer’s situation and remove
            anything that does not apply.
          </li>
          <li>
            <strong>Read it back</strong> before sending: name, order number, tone, and whether it answers every question asked.
          </li>
        </ul>
        <h3 className="p-h3">Tone</h3>
        <p>
          Match the formality of your brand and the seriousness of the issue. Be warm but professional. Avoid sarcasm, blame and phrases
          that sound defensive (“As I already said…”). In writing, CAPITALS and many exclamation marks read as shouting or carelessness.
        </p>
        <h3 className="p-h3">Positive, honest language</h3>
        <p>
          Focus on what you <em>can</em> do: “I can send a replacement today” rather than “I can’t refund this”. But positive framing must
          never hide the truth. If something is not possible, say so clearly and offer the best alternative.
        </p>
        <h3 className="p-h3">On the phone</h3>
        <p>
          Speak at a steady pace, signpost what you are doing (“I’m just opening your account now”), and ask permission before placing
          someone on hold, saying how long it will be. Silence on a call feels much longer to the customer than to you.
        </p>
        <Key>
          <li>Answer first, then explain. Plain words, short sentences, numbered steps.</li>
          <li>Give specific times you can keep.</li>
          <li>Always personalise templates and check before sending.</li>
          <li>Positive framing is good; misleading framing is not.</li>
        </Key>
        <Scenario
          n={3}
          title="The technical explanation"
          situation="A customer asks why their website is down. The engineers’ note says: “DNS propagation delay after nameserver migration; TTL 48h.”"
        >
          <p>
            Translate, do not forward. For example: “Your website moved to new servers yesterday. Internet providers update their records
            of where websites live at different speeds, so some people may not see your site for up to 48 hours. You don’t need to do
            anything. It should be visible to everyone by 10 am Thursday, and I’ll check in with you then.”
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Why is “I’ll get back to you soon” a weak commitment?',
              'It gives no time the customer can rely on, so they are likely to chase. A specific time sets an expectation and builds trust if kept.',
            ],
            [
              'What three things should you check before sending a templated reply?',
              'That it uses the right name and details, that every part applies to this customer, and that it answers all of their questions.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={4} title="Handling complaints and de-escalation">
        <p>
          A complaint is information: something did not meet the customer’s expectation. Handled well, a complaint can increase loyalty.
          Handled badly, it becomes a public review or a lost customer.
        </p>
        <h3 className="p-h3">A complaint-handling sequence</h3>
        <ol className="p-list">
          <li>
            <strong>Listen fully</strong> without interrupting or defending.
          </li>
          <li>
            <strong>Acknowledge</strong> the impact and, where appropriate, <strong>apologise</strong>.
          </li>
          <li>
            <strong>Clarify the facts</strong> and what outcome the customer wants.
          </li>
          <li>
            <strong>Explain the options</strong> within your authority, and agree a resolution.
          </li>
          <li>
            <strong>Act,</strong> or escalate with a full handover.
          </li>
          <li>
            <strong>Follow up</strong> to confirm it is resolved, and record the root cause.
          </li>
        </ol>
        <h3 className="p-h3">Apologising well</h3>
        <p>
          A good apology is sincere, specific and takes responsibility where the company was at fault: “I’m sorry we sent your order to
          the wrong address. That was our mistake.” Avoid non-apologies such as “We’re sorry if you feel…” which shift the problem onto the
          customer. When the cause is not yet known, you can still apologise for the experience while you investigate, without admitting
          facts you have not checked.
        </p>
        <h3 className="p-h3">De-escalation</h3>
        <p>
          Angry customers usually want to be heard first and helped second. To lower the temperature:
        </p>
        <ul className="p-list">
          <li>Stay calm and keep your voice even. Do not match their volume or tone.</li>
          <li>Let them vent, then acknowledge specifically what has gone wrong.</li>
          <li>Do not argue about details early on, and do not take it personally.</li>
          <li>Move to action: “Here is what I can do right now.”</li>
          <li>Give choices where you can; choice restores a sense of control.</li>
        </ul>
        <h3 className="p-h3">Saying no</h3>
        <p>
          Sometimes the answer is no. Explain the reason honestly, without hiding behind “policy”, and offer what you can do instead. If
          the customer asks for a manager, do not treat it as a failure: if the request is beyond your authority, escalating is the right
          step.
        </p>
        <Key>
          <li>Listen, acknowledge, clarify, resolve, act, follow up.</li>
          <li>Apologies should be specific and own the company’s mistakes.</li>
          <li>De-escalation starts with being heard; argument comes last, if at all.</li>
          <li>A clear, honest “no” with an alternative is better than a vague maybe.</li>
        </Key>
        <Scenario
          n={4}
          title="The public complaint"
          situation="A customer posts on social media that your company “steals money”, after a refund promised a week ago has not arrived."
        >
          <p>
            Reply publicly once, briefly and calmly: acknowledge the delay, apologise, and invite them to a private channel so you can
            check their account safely. Never discuss account details in public. In private, check the refund status, explain the
            specific reason for the delay and a realistic date, and follow up when it lands. Record the cause: if refunds are routinely
            late, that is a process problem to escalate.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Why is “We’re sorry you feel that way” likely to make a complaint worse?',
              'It apologises for the customer’s feelings rather than the problem and implies they are overreacting, which usually increases frustration.',
            ],
            [
              'A customer’s request is outside your authority. What should you do?',
              'Explain honestly what you can and cannot do, offer what is within your authority, and escalate to someone who can decide, with a full handover.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={5} title="Support channels and self-service">
        <p>
          Customers contact businesses through many channels. Each has strengths, and customers expect the same quality and the same
          history whichever they use.
        </p>
        <table className={styles.map}>
          <caption>Common channels</caption>
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Good for</th>
              <th scope="col">Watch out for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Phone</td>
              <td>Urgent, complex or emotional issues</td>
              <td>Hold times; no written record for the customer unless you send one</td>
            </tr>
            <tr>
              <td>Email</td>
              <td>Detailed issues, attachments, a written record</td>
              <td>Slow back-and-forth; ask all your questions at once</td>
            </tr>
            <tr>
              <td>Live chat</td>
              <td>Quick questions, guided steps</td>
              <td>Handling too many chats at once; short replies that sound curt</td>
            </tr>
            <tr>
              <td>Messaging apps</td>
              <td>Convenient, asynchronous conversations</td>
              <td>Verifying identity; keeping work and personal accounts separate</td>
            </tr>
            <tr>
              <td>Social media</td>
              <td>Public updates, first response</td>
              <td>Never share personal or account data publicly</td>
            </tr>
          </tbody>
        </table>
        <h3 className="p-h3">Omnichannel</h3>
        <p>
          When a customer emails, then chats, then calls about the same issue, they should not have to start again each time. Link or
          merge contacts about the same issue into one case, read the history first, and reply in one place so the customer gets one
          consistent answer.
        </p>
        <h3 className="p-h3">Self-service</h3>
        <p>
          Many customers prefer to help themselves. A good knowledge base is searchable, written in customers’ words, kept up to date,
          and makes it easy to reach a person if the article does not help. Self-service should reduce effort, not block access to help.
          When you answer a common question, link the relevant article and flag articles that are wrong or missing.
        </p>
        <h3 className="p-h3">Automation and chatbots</h3>
        <p>
          Bots can answer simple questions and collect details, but they must hand over to a person smoothly, passing on what the customer
          already said. Review automated answers for accuracy; a confident wrong answer from a bot is still your company’s answer.
        </p>
        <Key>
          <li>Choose the channel to suit the issue; keep quality the same across all channels.</li>
          <li>One issue, one case: link contacts and keep the history together.</li>
          <li>Self-service should make help easier, with a clear route to a person.</li>
          <li>Check and improve automated and knowledge-base answers.</li>
        </Key>
        <Scenario
          n={5}
          title="The bot loop"
          situation="A customer reaches live chat after the chatbot sent them the same unhelpful article three times. They write: “Finally, a human?”"
        >
          <p>
            Acknowledge the frustration and the wasted time, read what the customer already told the bot so you do not ask again, and
            solve the issue. Afterwards, report the loop with the conversation reference so the bot flow or article can be fixed.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Why should you avoid answering account questions on a public social post?',
              'Public posts can be seen by anyone, so sharing account or personal information there breaches the customer’s privacy. Move to a private, verified channel.',
            ],
            [
              'What makes a knowledge-base article useful to customers?',
              'It is easy to find, uses the customer’s language, is accurate and current, gives clear steps, and offers a way to contact a person.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={6} title="Tickets, prioritisation and SLAs">
        <p>
          A ticket is the record of one customer issue. Good ticket management means nothing is lost, the most important work is done
          first, and anyone can pick up a case and understand it.
        </p>
        <h3 className="p-h3">Ticket lifecycle</h3>
        <p>
          A typical flow is <strong>New → Open → Pending</strong> (waiting for the customer or another team) <strong>→ Solved → Closed</strong>.
          Use statuses honestly: “Pending” should mean you are genuinely waiting on someone else, not that the ticket has been forgotten.
          A ticket is solved when the customer’s issue is actually resolved, ideally confirmed with them, not merely when you have replied.
        </p>
        <h3 className="p-h3">Prioritising</h3>
        <p>
          Priority combines <strong>impact</strong> (how many people, how much harm: money, safety, security, a business stopped) and{' '}
          <strong>urgency</strong> (how time-sensitive it is). The oldest ticket is not always the most important, and the loudest customer
          is not automatically the most urgent.
        </p>
        <table className={styles.map}>
          <caption>An example priority scheme</caption>
          <thead>
            <tr>
              <th scope="col">Priority</th>
              <th scope="col">Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Urgent</td>
              <td>Suspected account compromise; service down for many customers; payments failing</td>
            </tr>
            <tr>
              <td>High</td>
              <td>One customer unable to use a key feature; a deadline today</td>
            </tr>
            <tr>
              <td>Normal</td>
              <td>A feature behaving oddly with a workaround; general account questions</td>
            </tr>
            <tr>
              <td>Low</td>
              <td>Feature suggestions; “how do I” questions with no time pressure</td>
            </tr>
          </tbody>
        </table>
        <h3 className="p-h3">SLAs</h3>
        <p>
          A service level agreement sets targets such as “first reply within 1 hour for urgent tickets” or “resolution within 3 business
          days”. Know which clock applies (first response or resolution, business hours or all hours). When a breach is coming, tell the
          customer and your lead early rather than sending an empty reply just to stop the clock. Meeting the SLA with a useless reply is
          not good service.
        </p>
        <h3 className="p-h3">Tags, notes and merging</h3>
        <ul className="p-list">
          <li>Tag tickets consistently so the team can report on trends.</li>
          <li>Use internal notes for facts and context colleagues need; keep them professional, because notes can be disclosed.</li>
          <li>Merge duplicates about the same issue so the customer gets one answer.</li>
        </ul>
        <Key>
          <li>Priority = impact × urgency, not age or volume.</li>
          <li>Statuses must reflect reality; “solved” means solved.</li>
          <li>Warn early about SLA breaches; never game the clock.</li>
          <li>Tag, note and merge so the queue tells the truth.</li>
        </Key>
        <Scenario
          n={6}
          title="Monday morning queue"
          situation="Your queue has: a shop owner whose checkout has been down since 7 am; a two-day-old question about changing an invoice address; a customer reporting a login from an unknown country; and a feature request."
        >
          <p>
            The possible account compromise and the checkout outage both have high impact and urgency. Take the security report first
            (or immediately route it to the security process) because harm can grow by the minute, then the outage. The invoice address
            question is next, as it is approaching its SLA; the feature request is low priority and can be logged and acknowledged.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'What is the difference between first response time and resolution time?',
              'First response time measures how long until the first human reply; resolution time measures how long until the issue is actually solved.',
            ],
            [
              'When is it appropriate to set a ticket to “Pending”?',
              'When you are genuinely waiting on the customer or another team for something specific, ideally noting what you are waiting for and when you will follow up.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={7} title="CRM, tools and documentation">
        <p>
          Support tools only help if the information in them is accurate. A CRM or help desk is the team’s shared memory: what the customer
          bought, what they have told you, and what has already been tried.
        </p>
        <h3 className="p-h3">Using customer history</h3>
        <p>
          Check the history before you reply. It tells you about earlier contacts, promises made, and the customer’s plan or products. It
          stops you asking them to repeat themselves and helps you spot a recurring problem.
        </p>
        <h3 className="p-h3">Writing good notes</h3>
        <p>A useful note lets the next person act without asking you. Include:</p>
        <ul className="p-list">
          <li>The issue in one sentence, in the customer’s terms.</li>
          <li>What was checked or tried, with the results.</li>
          <li>What was agreed with the customer, and any promise of time.</li>
          <li>The next action and who owns it.</li>
        </ul>
        <p>
          Write facts, not opinions about the customer. “Customer was rude” helps no one; “Customer was upset about a third failed
          delivery” does. Never put passwords, full card numbers or other unnecessary sensitive data in notes.
        </p>
        <h3 className="p-h3">Keeping records clean</h3>
        <p>
          Update contact details only after verification. Avoid creating duplicate customer records; search first. Correct wrong data when
          you find it, following your process. Bad data leads to wrong answers, wrong people being contacted and privacy breaches.
        </p>
        <h3 className="p-h3">Knowledge management</h3>
        <p>
          When you solve a new kind of problem, share it: suggest an internal article or a macro. When an article is out of date, flag it.
          Teams that write things down solve problems faster and more consistently.
        </p>
        <Key>
          <li>Read the history before replying.</li>
          <li>Notes: issue, actions, agreements, next step and owner. Facts, not opinions.</li>
          <li>Keep sensitive data out of notes and keep records accurate.</li>
          <li>Turn solutions into shared knowledge.</li>
        </Key>
        <Scenario
          n={7}
          title="The handover note"
          situation="You are ending your shift with an open case: a customer’s data export keeps failing. You have tried two fixes and are waiting for an engineer."
        >
          <p>
            A strong note reads like this: “Data export fails at 90% for files over 2 GB (customer’s words: ‘it freezes near the end’).
            Tried: cleared cache, smaller date range (works under 2 GB). Engineering ticket ENG-4821 raised 14:10. Told customer we’d
            update by 12 noon tomorrow. Next: check ENG-4821 in the morning and update the customer either way.”
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Why should notes avoid personal opinions about a customer?',
              'They are unprofessional, do not help colleagues act, can bias how the customer is treated, and may be disclosed to the customer.',
            ],
            [
              'Name two risks of duplicate customer records.',
              'Colleagues miss important history, and messages or personal data may go to the wrong record or address.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={8} title="Privacy, security and professional ethics">
        <p>
          Support staff can see and change customer accounts, which makes them a target for fraud and gives them responsibility for
          people’s personal data. In Nigeria, the Nigeria Data Protection Act 2023 sets out how personal data must be handled; your
          employer’s policies explain how that applies in your role.
        </p>
        <h3 className="p-h3">Principles for handling personal data</h3>
        <ul className="p-list">
          <li>
            <strong>Use it only for the purpose it was collected for.</strong> Looking up a customer out of curiosity is a breach.
          </li>
          <li>
            <strong>Collect and show only what you need</strong> (data minimisation). Do not ask for a full card number if the last four
            digits are enough.
          </li>
          <li>
            <strong>Keep it accurate and secure.</strong> Lock your screen, do not share logins, and do not copy data into personal
            devices or apps.
          </li>
          <li>
            <strong>Keep it only as long as needed,</strong> following your company’s retention rules.
          </li>
          <li>
            <strong>Pass on rights requests.</strong> If a customer asks for a copy of their data, or for it to be corrected or deleted,
            follow the process for data requests.
          </li>
        </ul>
        <h3 className="p-h3">Verification and social engineering</h3>
        <p>
          Always verify identity before discussing or changing an account, using your approved checks. Fraudsters use urgency, authority
          and emotion: “I’m the CEO, I need access now,” or “My husband is in hospital, please give me his password.” Being helpful does not
          mean skipping verification. If you cannot verify someone, explain kindly what they can do instead.
        </p>
        <h3 className="p-h3">Payment and sensitive data</h3>
        <p>
          Never ask customers to send full card numbers, PINs, one-time codes or passwords by chat, email or social media, and never write
          them down. If a customer starts to share such details, stop them, remove or mask the data according to your process, and direct
          them to the secure payment method.
        </p>
        <h3 className="p-h3">If something goes wrong</h3>
        <p>
          If you send data to the wrong person or see a possible breach, report it immediately through your company’s process. Do not try
          to hide it or fix it quietly. Speed matters because the business may have legal duties to act and notify.
        </p>
        <h3 className="p-h3">Professional boundaries and ethics</h3>
        <ul className="p-list">
          <li>Do not accept gifts or payments from customers in return for special treatment.</li>
          <li>Do not handle accounts of friends or family; pass them to a colleague.</li>
          <li>Do not contact customers through personal accounts.</li>
          <li>Be honest. Never invent policies, promise what you cannot deliver, or hide known problems.</li>
          <li>Treat every customer fairly and without discrimination.</li>
        </ul>
        <Key>
          <li>Use personal data only for its purpose; collect and show the minimum.</li>
          <li>Verify identity every time; urgency and authority are classic fraud tactics.</li>
          <li>Card numbers, PINs, passwords and one-time codes never go through chat or email.</li>
          <li>Report mistakes and breaches at once.</li>
        </Key>
        <Scenario
          n={8}
          title="The urgent “manager”"
          situation="A caller says they are the finance director of a business customer, cannot log in, and need you to change the account email to their personal address right now before a payment deadline."
        >
          <p>
            Recognise the pressure pattern. Be polite and follow verification exactly. Do not change contact details on an unverified
            request, however senior the caller claims to be. Offer the legitimate route (for example the account owner confirming through
            the registered email) and note the call. If the request looks like fraud, report it through the security process.
          </p>
        </Scenario>
        <Scenario
          n={9}
          title="Wrong recipient"
          situation="You realise you just emailed a customer’s invoice, with their name and address, to a different customer with a similar name."
        >
          <p>
            Report it straight away to your team lead or data protection contact, following your process. Do not wait to see whether
            anyone notices. The business may need to ask the recipient to delete the email, inform the affected customer and record the
            incident. Then check what caused the mix-up so it does not happen again.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'A customer offers you a gift voucher for “sorting things out so quickly”. What should you do?',
              'Thank them and politely decline or follow your company’s gifts policy; accepting could look like payment for special treatment.',
            ],
            [
              'What is data minimisation, and give one example in support?',
              'Using only the personal data needed for the task, for example asking for the last four digits of a card rather than the full number.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={9} title="Service recovery and retention">
        <p>
          Service recovery is what you do after something has gone wrong to put it right and restore trust. Customers often judge a
          company more by how it handles a failure than by the failure itself.
        </p>
        <h3 className="p-h3">Elements of good recovery</h3>
        <ol className="p-list">
          <li>
            <strong>Acknowledge and apologise</strong> quickly and specifically.
          </li>
          <li>
            <strong>Fix the problem</strong> for this customer, as fast as possible.
          </li>
          <li>
            <strong>Make it fair.</strong> Where the customer lost time or money because of you, a proportionate gesture (a refund of a
            delivery charge, a credit) can help. It should fit the impact and your company’s rules.
          </li>
          <li>
            <strong>Follow up</strong> to confirm it worked.
          </li>
          <li>
            <strong>Fix the cause,</strong> by reporting it so it does not happen to the next customer.
          </li>
        </ol>
        <p>
          Compensation is not a substitute for fixing the problem. A voucher sent while the original issue is still broken usually feels
          like being brushed off.
        </p>
        <h3 className="p-h3">Retention</h3>
        <p>
          When a customer wants to cancel, first understand why. Sometimes there is a real fix (a cheaper plan, a fault that can be
          solved). Sometimes the right outcome is to make leaving easy and pleasant. Pressuring customers to stay, hiding the cancel route
          or making false promises damages trust and can break consumer rules. A customer who leaves well may come back and will speak
          better of you.
        </p>
        <h3 className="p-h3">Satisfied is not the same as loyal</h3>
        <p>
          A customer can rate one interaction highly and still leave, because the underlying product or repeated problems have not
          changed. Retention depends on solving root causes, not only on pleasant conversations.
        </p>
        <Key>
          <li>Acknowledge, fix, make fair, follow up, fix the cause.</li>
          <li>Gestures should be proportionate and never replace the actual fix.</li>
          <li>Understand cancellation reasons; do not trap customers.</li>
          <li>Loyalty comes from fixing root causes.</li>
        </Key>
        <Scenario
          n={10}
          title="The third failure"
          situation="A long-standing customer’s internet connection has failed for the third time this month. They say they are switching providers."
        >
          <p>
            Acknowledge the pattern honestly: three failures is not acceptable. Check what is causing the repeats rather than running the
            same fix again. Offer what is within your authority (for example a credit for the lost days) and escalate the repeated fault
            with full history so a specialist looks at the root cause. Tell the customer exactly what will happen next and when. If they
            still want to leave, help them do so smoothly.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Why might compensation make a customer angrier?',
              'If the underlying problem is not fixed, or the gesture feels tiny compared with the impact, it can seem like an attempt to make them go away.',
            ],
            [
              'What should you report after resolving a service failure for one customer?',
              'The root cause and any pattern, so the process or product can be fixed and other customers are not affected.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={10} title="Metrics and quality assurance">
        <p>
          Metrics help a team see how it is doing. Each measures one thing, and each can be misleading on its own. Read them together and
          always ask what behaviour a target will encourage.
        </p>
        <table className={styles.map}>
          <caption>Common support metrics</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">What it tells you</th>
              <th scope="col">Limitation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CSAT</td>
              <td>Satisfaction with a recent interaction</td>
              <td>Low response rates; reflects the outcome (e.g. a refusal) as well as the agent’s skill</td>
            </tr>
            <tr>
              <td>CES</td>
              <td>How easy it was to get help</td>
              <td>Says little about the friendliness of the interaction</td>
            </tr>
            <tr>
              <td>NPS</td>
              <td>Overall loyalty to the company</td>
              <td>Affected by price, product and much more than support</td>
            </tr>
            <tr>
              <td>First response time</td>
              <td>How long customers wait for a first reply</td>
              <td>A fast but empty reply looks good here</td>
            </tr>
            <tr>
              <td>Resolution time</td>
              <td>How long issues take to solve</td>
              <td>Rushing to close tickets can increase reopens</td>
            </tr>
            <tr>
              <td>First contact resolution</td>
              <td>Issues solved without follow-up</td>
              <td>Depends on how “resolved” is defined</td>
            </tr>
            <tr>
              <td>Reopen rate</td>
              <td>Issues that were not really fixed</td>
              <td>Some customers reply “thanks”, which can reopen tickets</td>
            </tr>
            <tr>
              <td>Backlog</td>
              <td>Work waiting</td>
              <td>Says nothing about how old or urgent the tickets are</td>
            </tr>
          </tbody>
        </table>
        <h3 className="p-h3">Balancing metrics</h3>
        <p>
          Pair a speed metric with a quality metric. If resolution time falls while reopens rise, tickets are probably being closed before
          they are fixed. If CSAT is high but contacts keep growing, customers may like the agents but keep hitting the same product
          problem.
        </p>
        <h3 className="p-h3">Quality assurance</h3>
        <p>
          QA reviews a sample of conversations against a scorecard: accuracy, following process (including verification), clarity, tone,
          ownership and correct notes. The aim is coaching, not punishment. Good QA is calibrated, meaning reviewers regularly score the
          same conversations and agree on what “good” looks like, and feedback is specific with examples.
        </p>
        <Key>
          <li>Every metric measures one thing; read speed and quality together.</li>
          <li>Targets shape behaviour; watch for gaming.</li>
          <li>CSAT is about an interaction; NPS is about the company; CES is about effort.</li>
          <li>QA is for coaching and consistency, with calibrated scorecards.</li>
        </Key>
        <Scenario
          n={11}
          title="The great first-response time"
          situation="After a new target, a team’s first response time drops from 6 hours to 20 minutes, but CSAT falls and customers complain they are “getting the same message twice”."
        >
          <p>
            Agents are probably sending holding replies to stop the clock. Look at a sample of first replies. The fix is to measure what
            matters (time to a useful reply, resolution and reopen rate alongside speed) and to coach on writing first replies that move
            the issue forward.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Which metric would best show whether a new self-service guide makes things easier for customers?',
              'Customer effort score (alongside the number of contacts on that topic) because it measures how easy customers found it to get help.',
            ],
            [
              'Why should QA reviewers calibrate?',
              'So they apply the scorecard consistently and agents get fair, consistent feedback.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={11} title="Escalation, teamwork and judgment">
        <p>
          No agent can solve everything alone. Knowing when and how to involve others is a core skill, and so is using judgment when the
          rules do not cover a situation exactly.
        </p>
        <h3 className="p-h3">When to escalate</h3>
        <ul className="p-list">
          <li>The fix needs skills or system access you do not have (functional escalation).</li>
          <li>The decision is beyond your authority, such as a large refund or a policy exception (hierarchical escalation).</li>
          <li>There is a safety, security, legal or data protection risk.</li>
          <li>Many customers are affected: a possible incident.</li>
          <li>You have tried the documented steps and the issue is not resolved.</li>
        </ul>
        <p>Escalate early when there is risk; do not keep a customer waiting while you try things outside your knowledge.</p>
        <h3 className="p-h3">How to escalate</h3>
        <p>
          A good escalation includes: a clear summary, the customer’s impact and urgency, steps to reproduce or evidence (screenshots,
          error messages, times), what has been tried, and what you need from the other team. Tell the customer what you have done and when
          they will hear back, and stay the owner of the communication unless the case is formally transferred.
        </p>
        <h3 className="p-h3">Teamwork</h3>
        <p>
          Share what you learn, cover for colleagues’ follow-ups when they are away, and raise patterns early. If you see a colleague
          giving wrong information, correct it constructively and privately where possible, focusing on the customer outcome.
        </p>
        <h3 className="p-h3">Judgment when rules do not fit</h3>
        <p>When a situation is unusual, ask:</p>
        <ol className="p-list">
          <li>Is anyone at risk of harm, fraud or a data breach? Deal with that first.</li>
          <li>What is honest and fair to the customer?</li>
          <li>Is this within my authority? If not, who decides?</li>
          <li>Will my colleagues be able to see what I did and why?</li>
        </ol>
        <p>
          When you are unsure, the safe option is to protect the customer and the data, be honest about what you know, and ask someone with
          the authority to decide.
        </p>
        <Key>
          <li>Escalate for skill, authority, risk or scale, and do it early when there is risk.</li>
          <li>Handovers: summary, impact, evidence, what was tried, what you need.</li>
          <li>Keep the customer informed; keep ownership of communication.</li>
          <li>Judgment: safety first, then honesty and fairness, then authority.</li>
        </Key>
        <Scenario
          n={12}
          title="The pattern nobody has noticed"
          situation="In one afternoon you handle four separate chats from customers whose discount codes are being rejected at checkout."
        >
          <p>
            Four similar reports suggest a wider fault. Check whether a known issue is already logged. If not, raise one with your team
            lead or the incident channel, with the examples, times and error messages, so it can be investigated once rather than four
            times. Give affected customers a workaround or an honest update, and add the reference to each ticket.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'What is the difference between functional and hierarchical escalation?',
              'Functional escalation moves the case to someone with the right specialist skill; hierarchical escalation moves it to someone with more authority to decide.',
            ],
            [
              'Why should you tell the customer when you escalate their issue?',
              'So they know it is being worked on, by whom (in general terms) and when they will hear back, which reduces repeat contacts and anxiety.',
            ],
          ]}
        />
      </Chapter>

      <Chapter n={12} title="Difficult conversations, abuse and wellbeing">
        <p>
          Most upset customers are reacting to a real problem, and the skills in chapter 4 will calm most conversations. Occasionally a
          customer crosses the line into abuse. Support staff are entitled to work without being abused, and companies should have a clear
          policy.
        </p>
        <h3 className="p-h3">Frustration or abuse?</h3>
        <p>
          A customer who is angry about the problem (“This is ridiculous, I’ve waited a week!”) is frustrated. Personal insults, threats,
          discriminatory language or harassment directed at you are abuse.
        </p>
        <h3 className="p-h3">Responding to abuse</h3>
        <ol className="p-list">
          <li>Stay calm and do not respond in kind.</li>
          <li>Set a clear boundary: “I want to help sort this out, but I can’t continue if the personal comments continue.”</li>
          <li>Redirect to the problem and what you can do.</li>
          <li>If the abuse continues, end the conversation according to your policy, explaining how they can get help.</li>
          <li>Record the facts in the notes and tell your team lead.</li>
          <li>Any threat of violence or self-harm is escalated immediately according to your safety policy.</li>
        </ol>
        <h3 className="p-h3">Vulnerable customers</h3>
        <p>
          Some customers are in difficult circumstances: illness, bereavement, financial hardship, or difficulty understanding. Be patient,
          check understanding, offer more time or a different channel, and follow any process for extra support. Never take advantage of
          someone’s situation, and stay within your role.
        </p>
        <h3 className="p-h3">Looking after yourself</h3>
        <p>
          Support work can be draining. Take your breaks, step away briefly after a difficult call when you can, and talk to your team lead
          or colleagues. Do not carry an abusive interaction alone. Signs of stress such as dreading every contact, irritability and poor
          sleep are worth raising early.
        </p>
        <Key>
          <li>Frustration is about the problem; abuse is directed at you.</li>
          <li>Set a boundary, redirect, and end the conversation if abuse continues.</li>
          <li>Record, report and escalate threats immediately.</li>
          <li>Adapt for vulnerable customers; look after your own wellbeing.</li>
        </Key>
        <Scenario
          n={13}
          title="Crossing the line"
          situation="During a chat about a delayed refund, a customer begins using insulting and offensive language about you personally."
        >
          <p>
            Stay professional. Acknowledge the refund delay, then set a clear boundary that you will continue to help but cannot accept
            personal abuse. If it continues, end the chat according to your company’s policy, tell the customer how they can continue
            (for example by email), and record and report what happened. The refund issue still needs to be resolved by someone.
          </p>
        </Scenario>
        <Revision
          items={[
            [
              'Is a customer who says “This service is useless!” being abusive?',
              'Usually not. They are expressing frustration about the service rather than attacking you personally. Acknowledge it and help.',
            ],
            [
              'Name two ways to support a customer who seems to be struggling to understand the steps you are giving.',
              'Slow down and use simpler words, check understanding at each step, offer to send written steps or switch to a phone call.',
            ],
          ]}
        />
      </Chapter>

      <section id="glossary" className={styles.chapter} aria-labelledby="glossary-title">
        <h2 id="glossary-title" className="p-h2">
          Glossary
        </h2>
        <dl className={styles.glossary}>
          {GLOSSARY.map(([term, def]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="checklist" className={styles.chapter} aria-labelledby="checklist-title">
        <h2 id="checklist-title" className="p-h2">
          Practice checklist
        </h2>
        <p>Use this checklist on real or practice conversations until the habits become automatic.</p>
        <ul className={styles.checklist}>
          {CHECKLIST.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className={`${styles.chapter} p-noprint`} aria-labelledby="ready">
        <h2 id="ready" className="p-h2">
          Ready?
        </h2>
        <p>When you are comfortable with the chapters, the scenarios and the revision questions, take the assessment.</p>
        <p style={{ marginTop: 16 }}>
          <Link className="p-btn p-btn--accent" href={paths.dashboard}>
            Go to my assessment
          </Link>
        </p>
      </section>
    </div>
  );
}
