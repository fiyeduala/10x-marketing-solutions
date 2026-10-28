/**
 * SERVER-ONLY question bank and answer key.
 *
 * This module must never be imported from src/. It is bundled only into the
 * Vercel function. To change questions, edit this file, bump
 * QUESTION_BANK_VERSION, run the tests (they check the blueprint), and deploy.
 * Attempts record the version they were served, so old attempts stay
 * traceable.
 */

export const QUESTION_BANK_VERSION = 'csp-2026.10-v1';

export type OptionKey = 'a' | 'b' | 'c' | 'd';
export const OPTION_KEYS: readonly OptionKey[] = ['a', 'b', 'c', 'd'];

export type Category =
  | 'fundamentals'
  | 'communication'
  | 'complaints'
  | 'tickets'
  | 'crm'
  | 'privacy'
  | 'recovery'
  | 'metrics'
  | 'judgment';

export type Difficulty = 'foundational' | 'intermediate' | 'advanced';

export interface BankQuestion {
  id: string;
  category: Category;
  difficulty: Difficulty;
  scenario: boolean;
  prompt: string;
  options: Record<OptionKey, string>;
  correct: OptionKey;
  explanation: string;
  /** Why each wrong option is wrong (the misconception it represents). */
  distractors: Partial<Record<OptionKey, string>>;
}

/** Category metadata. `bankCount` is the blueprint and is enforced by tests. */
export const CATEGORIES: Record<Category, { label: string; bankCount: number; chapters: number[] }> = {
  fundamentals: { label: 'Customer support fundamentals and customer experience', bankCount: 4, chapters: [1] },
  communication: { label: 'Communication, empathy and active listening', bankCount: 5, chapters: [2, 3] },
  complaints: { label: 'Complaint resolution and de-escalation', bankCount: 6, chapters: [4, 12] },
  tickets: { label: 'Ticket management, prioritisation and SLAs', bankCount: 5, chapters: [6] },
  crm: { label: 'CRM, support tools and documentation', bankCount: 4, chapters: [7] },
  privacy: { label: 'Privacy, security, ethics and professional boundaries', bankCount: 5, chapters: [8] },
  recovery: { label: 'Service recovery and customer retention', bankCount: 4, chapters: [9] },
  metrics: { label: 'Support metrics and quality assurance', bankCount: 3, chapters: [10] },
  judgment: { label: 'Escalation, teamwork and situational judgment', bankCount: 4, chapters: [11, 12] },
};

export const QUESTION_BANK: readonly BankQuestion[] = [
  // --- Customer support fundamentals and customer experience (4) ---------
  {
    id: 'Q01',
    category: 'fundamentals',
    difficulty: 'foundational',
    scenario: false,
    prompt: 'Which statement best describes the difference between customer support and customer success?',
    options: {
      a: 'Customer support serves paying customers, while customer success manages prospects who have not yet bought anything.',
      b: 'Customer support resolves issues customers raise, while customer success works proactively to help customers achieve their goals.',
      c: 'Customer support works over the telephone, while customer success covers every written channel such as email, chat and social media.',
      d: 'There is no real difference; companies simply use the two names for the same team doing the same work.',
    },
    correct: 'b',
    explanation:
      'Support is largely reactive: it responds to questions and problems customers bring. Customer success is proactive and outcome-focused: it helps existing customers adopt the product and reach the results they bought it for.',
    distractors: {
      a: 'Both functions serve existing customers. Prospects are the concern of sales and marketing.',
      c: 'The distinction is about purpose, not channel. Both functions use phone, email and chat.',
      d: 'Many organisations run them as separate teams with different goals and measures, even if they work closely together.',
    },
  },
  {
    id: 'Q02',
    category: 'fundamentals',
    difficulty: 'intermediate',
    scenario: true,
    prompt:
      "A customer's internet service was restored within the promised two hours, but they had to repeat their account details to three different agents and were never told the cause. What does this most clearly illustrate?",
    options: {
      a: 'The service-level target was met, so the overall customer experience was satisfactory.',
      b: 'The fault was technical, so the support team had no real influence over the experience.',
      c: 'Customers tend to exaggerate inconvenience once their problem has already been fixed.',
      d: 'Resolving the fault is not the same as giving the customer a positive overall experience.',
    },
    correct: 'd',
    explanation:
      'The technical outcome was achieved, but the journey was poor: repeated identification and no explanation. Customer experience covers the whole interaction, not only whether the fault was fixed.',
    distractors: {
      a: 'Meeting an SLA is one measure. It says nothing about effort, communication or how the customer felt.',
      b: 'Support controlled the hand-offs and the communication, which is exactly where the experience failed.',
      c: 'Dismissing the customer’s account of the experience ignores real process failures.',
    },
  },
  {
    id: 'Q03',
    category: 'fundamentals',
    difficulty: 'foundational',
    scenario: false,
    prompt: 'Which of these is an example of proactive support?',
    options: {
      a: 'Telling affected customers about a planned outage before it starts, with times and alternatives.',
      b: "Answering a customer's question about the outage as soon as they contact the help desk.",
      c: 'Closing outage-related tickets quickly once the service has been fully restored for everyone.',
      d: 'Publishing an apology on social media after customers begin complaining about the outage.',
    },
    correct: 'a',
    explanation:
      'Proactive support anticipates a need and acts before the customer has to ask. Warning customers about a planned outage prevents confusion and unnecessary contacts.',
    distractors: {
      b: 'Responding quickly is good reactive support, but the customer still had to make contact first.',
      c: 'Closing tickets is an operational task after the event, not anticipation of a need.',
      d: 'An apology after complaints start is a reaction to customer pressure.',
    },
  },
  {
    id: 'Q04',
    category: 'fundamentals',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      "A new representative tells a customer, \"I'll make sure engineering fixes this today.\" Engineering has not committed to any timeline. What is the main problem with this response?",
    options: {
      a: 'It is too informal for a written support channel and should have used more formal wording.',
      b: 'It should have promised a refund instead, because a refund is easier for support to deliver.',
      c: 'It commits to an outcome the representative does not control, which risks breaking trust.',
      d: 'It reveals that an engineering team exists, which counts as confidential internal information.',
    },
    correct: 'c',
    explanation:
      'Representatives should commit only to what they can deliver, such as investigating, escalating and giving updates. A promise that depends on another team, with no commitment from them, is likely to be broken and damage trust.',
    distractors: {
      a: 'Tone is not the issue. A friendly, informal message can be perfectly professional.',
      b: 'Promising a refund without authority repeats the same mistake with a different outcome.',
      d: 'Mentioning that a technical team is investigating is normal and helps set expectations.',
    },
  },

  // --- Communication, empathy and active listening (5) --------------------
  {
    id: 'Q05',
    category: 'communication',
    difficulty: 'foundational',
    scenario: false,
    prompt: 'Which behaviour best demonstrates active listening on a support call?',
    options: {
      a: 'Preparing your answer while the customer is still describing the problem, to save time.',
      b: 'Interrupting early to tell the customer which department usually handles that type of issue.',
      c: "Summarising the customer's issue in your own words and checking that you have understood it.",
      d: 'Staying completely silent throughout the call so the customer never feels interrupted.',
    },
    correct: 'c',
    explanation:
      'Active listening means attending fully and then confirming understanding. Paraphrasing and checking shows the customer they have been heard and catches misunderstandings early.',
    distractors: {
      a: 'Planning a reply while the customer speaks means you are only half listening and may miss key details.',
      b: 'Interrupting to route the call before understanding it often sends the customer to the wrong place.',
      d: 'Silence is not listening. Customers need acknowledgement and clarifying questions.',
    },
  },
  {
    id: 'Q06',
    category: 'communication',
    difficulty: 'intermediate',
    scenario: true,
    prompt:
      "A customer writes: \"This is the third time my order has been delayed. I needed it for my daughter's birthday tomorrow.\" Which reply best combines empathy with honesty?",
    options: {
      a: "\"I'm sorry—three delays with a birthday tomorrow is really frustrating. Let me check where the order is now and tell you what can still be done.\"",
      b: "\"I completely understand how you feel. Please don't worry at all—I will personally make sure the order arrives in time for the birthday tomorrow.\"",
      c: '"I understand. Delays like this are usually caused by the courier, and unfortunately support has no control over how the courier performs."',
      d: '"Thank you for contacting us about your order. Your feedback is very important to us and it has now been passed on to the relevant team."',
    },
    correct: 'a',
    explanation:
      'The best reply acknowledges the specific impact (three delays, a birthday), apologises, and commits only to actions within the agent’s control: checking status and explaining real options.',
    distractors: {
      b: 'It sounds caring but promises a delivery time the agent cannot guarantee.',
      c: 'It deflects blame to the courier and offers nothing, which usually escalates frustration.',
      d: 'A generic acknowledgement ignores the customer’s situation and gives no next step.',
    },
  },
  {
    id: 'Q07',
    category: 'communication',
    difficulty: 'intermediate',
    scenario: true,
    prompt: 'A customer on live chat says, "Your app doesn\'t work." What is the most useful first response?',
    options: {
      a: 'Send the link to the general troubleshooting guide so they can work through it alone.',
      b: 'Ask them to uninstall and reinstall the app, because that solves most reported problems.',
      c: 'Tell them the app is working for other customers, so the problem must be on their side.',
      d: 'Ask what they were trying to do and what happened, including any error message they saw.',
    },
    correct: 'd',
    explanation:
      '"Doesn’t work" is a symptom, not a diagnosis. Open clarifying questions about the goal, the behaviour and any error give you the facts needed to help efficiently.',
    distractors: {
      a: 'A generic guide may not match the problem and pushes the effort back onto the customer.',
      b: 'Prescribing a fix before understanding the problem wastes time and may lose data or settings.',
      c: 'This assumes the cause and sounds dismissive, even if the issue does turn out to be local.',
    },
  },
  {
    id: 'Q08',
    category: 'communication',
    difficulty: 'intermediate',
    scenario: true,
    prompt:
      'You have sent a customer the steps to reset a device. They reply only "ok". Before closing the conversation, what should you do?',
    options: {
      a: 'Close the ticket straight away, because the reply "ok" confirms the steps have worked.',
      b: 'Ask whether the device now works as expected, and offer help if any step has failed.',
      c: 'Send the same steps again in more detail, in case the customer only skimmed them.',
      d: 'Leave the ticket open with no follow-up until the customer chooses to write back.',
    },
    correct: 'b',
    explanation:
      '"Ok" may mean "received", not "resolved". A short confirmation question checks the actual outcome before closure and avoids reopened tickets.',
    distractors: {
      a: 'Assuming resolution from an ambiguous reply is a common cause of reopened tickets.',
      c: 'Repeating the instructions without knowing whether they failed adds effort and can seem patronising.',
      d: 'Passive waiting leaves the ticket in limbo. Good practice is to confirm, then follow the closure procedure.',
    },
  },
  {
    id: 'Q09',
    category: 'communication',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'A frustrated customer on the phone asks why their payment failed. The cause is a technical bank-routing error. Which explanation is most effective?',
    options: {
      a: 'A brief plain-language explanation of what happened, what it means for them, and the next step.',
      b: 'A detailed technical explanation of the routing error so they can see how complex the issue is.',
      c: 'No explanation at all, because technical details might be repeated publicly by the customer.',
      d: 'An explanation that the bank caused the failure and the company is therefore not responsible.',
    },
    correct: 'a',
    explanation:
      'Frustrated customers need clarity: what happened in plain terms, how it affects them, and what happens next. Technical depth is only useful if they ask for it.',
    distractors: {
      b: 'Jargon-heavy detail rarely reassures; it can sound like an excuse and obscure the next step.',
      c: 'Withholding a reasonable explanation damages trust. The cause can usually be described without sensitive detail.',
      d: 'Shifting blame does not help the customer and may be inaccurate. Focus on the resolution.',
    },
  },

  // --- Complaint resolution and de-escalation (6) -------------------------
  {
    id: 'Q10',
    category: 'complaints',
    difficulty: 'intermediate',
    scenario: true,
    prompt: 'An angry customer is shouting about a billing error. Which first step is most likely to de-escalate the conversation?',
    options: {
      a: 'Explain the billing policy in full so that they understand why the charge was applied.',
      b: 'Tell the customer that you will end the call unless they lower their voice right now.',
      c: 'Transfer them to the billing team immediately so the right people deal with the anger.',
      d: 'Let them finish, acknowledge the impact on them, and confirm that you will look into it.',
    },
    correct: 'd',
    explanation:
      'De-escalation starts with letting the customer be heard and acknowledging the impact. Once they feel understood they can engage with facts and solutions.',
    distractors: {
      a: 'Leading with policy before acknowledging the problem usually sounds defensive and raises tension.',
      b: 'Raised voices are not the same as abuse. An early ultimatum escalates rather than calms.',
      c: 'An immediate cold transfer makes the customer repeat their story and often increases anger.',
    },
  },
  {
    id: 'Q11',
    category: 'complaints',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'A customer demands a full refund for a service used for eleven months. Policy allows refunds only within 14 days, and you have no authority to make exceptions. What should you do?',
    options: {
      a: "Approve the refund to protect the company's reputation, then tell your manager afterwards.",
      b: 'Explain the policy honestly, offer what you can, and explain how to request a formal review.',
      c: 'Say the refund is "being processed" so the call ends calmly, then close the ticket quietly.',
      d: 'Refuse firmly and end the conversation, because the written policy is clear and final.',
    },
    correct: 'b',
    explanation:
      'Stay within your authority, be transparent about the policy, offer any legitimate alternatives, and give the customer a fair route to escalate or appeal if one exists.',
    distractors: {
      a: 'Granting what you are not authorised to give, then informing others, breaks policy and sets an inconsistent precedent.',
      c: 'Saying something false to end a call is dishonest and guarantees a worse complaint later.',
      d: 'The policy may be clear, but ending the conversation without alternatives or a review route is unhelpful.',
    },
  },
  {
    id: 'Q12',
    category: 'complaints',
    difficulty: 'intermediate',
    scenario: true,
    prompt: 'A customer begins using personal insults toward you during a chat. What is the most appropriate response?',
    options: {
      a: 'Stay calm, say that abuse is not acceptable, and follow the abuse policy if it continues.',
      b: 'Respond just as firmly, quoting each insult back so the customer can see their own behaviour.',
      c: 'Ignore the insults and carry on working, because tolerating abuse is simply part of the role.',
      d: 'End the chat at once without any warning, since an insult removes the right to support.',
    },
    correct: 'a',
    explanation:
      'Professional boundaries matter. A calm, clear statement that abuse is unacceptable, with an offer to keep helping, often resets the tone. The organisation’s policy then guides warnings and ending the contact.',
    distractors: {
      b: 'Mirroring hostility escalates the conflict and is unprofessional.',
      c: 'Representatives are not required to accept abuse. Ignoring it can let it escalate.',
      d: 'Most policies require a clear warning first, unless there are threats or the abuse is severe.',
    },
  },
  {
    id: 'Q13',
    category: 'complaints',
    difficulty: 'foundational',
    scenario: false,
    prompt: "Which apology is most appropriate when a delivery was delayed by your company's own error?",
    options: {
      a: '"We apologise if you feel that you may have been inconvenienced in any way by this."',
      b: '"Sorry, but delays like this are sometimes unavoidable in this line of business."',
      c: '"I\'m sorry your order arrived late—that was our mistake, and here is what we\'ll do."',
      d: '"Sorry for any confusion; the courier will be in touch with you shortly with an update."',
    },
    correct: 'c',
    explanation:
      'A good apology is specific, takes ownership where the company is at fault, and moves straight to the remedy.',
    distractors: {
      a: 'A conditional "if you feel" apology shifts the problem onto the customer’s feelings and sounds insincere.',
      b: 'Using "sorry, but" to excuse the delay cancels the apology.',
      d: 'It misdescribes the issue as confusion and hands responsibility to the courier.',
    },
  },
  {
    id: 'Q14',
    category: 'complaints',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'A customer contacts you for the fourth time about the same recurring billing error. Each previous agent corrected the bill, but the error returned. What is the best action?',
    options: {
      a: "Correct this month's bill again and add a note asking the customer to call if it recurs.",
      b: 'Offer a goodwill credit so the customer is satisfied, and close the ticket as resolved.',
      c: 'Advise the customer to switch to a different billing plan to avoid the error in future.',
      d: 'Correct the bill, then escalate the recurring fault with the full history so it is fixed.',
    },
    correct: 'd',
    explanation:
      'Fixing the symptom each month has failed four times. The customer needs the immediate correction and an escalation, with the documented history, so the root cause is investigated and owned.',
    distractors: {
      a: 'Repeating the same fix guarantees a fifth contact and treats the customer as the monitoring system.',
      b: 'A credit may be appropriate, but closing without addressing the cause leaves the fault in place.',
      c: 'This pushes the customer to work around a company fault that should be fixed.',
    },
  },
  {
    id: 'Q15',
    category: 'complaints',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'A customer says they will post about their bad experience on social media unless you give them compensation immediately. What should guide your response?',
    options: {
      a: 'The threat of public criticism justifies offering compensation beyond your usual authority.',
      b: 'The complaint’s merits and the policy, applied the same whether or not a post is threatened.',
      c: "The customer's follower count, since influential customers create larger reputational risks.",
      d: 'The need to warn the customer that posting about the company may lead to legal action.',
    },
    correct: 'b',
    explanation:
      'Outcomes should be fair and consistent. Resolve the complaint on its merits and within policy; a threatened post should not change what the customer is entitled to.',
    distractors: {
      a: 'Rewarding threats creates unfair, inconsistent outcomes and encourages more threats.',
      c: 'Treating customers differently by influence is unfair and undermines trust if discovered.',
      d: 'Threatening legal action over honest reviews escalates the conflict and can cause real reputational harm.',
    },
  },

  // --- Ticket management, prioritisation and SLAs (5) ---------------------
  {
    id: 'Q16',
    category: 'tickets',
    difficulty: 'intermediate',
    scenario: true,
    prompt: 'You have four new tickets in your queue. Which should you handle first?',
    options: {
      a: 'A customer asking how to change their profile picture, waiting for three hours.',
      b: "A complaint about the tone of a previous agent's email, waiting for two hours.",
      c: "A business customer's whole team is unable to log in, waiting for ten minutes.",
      d: "A request for copies of last year's invoices, waiting for one hour so far.",
    },
    correct: 'c',
    explanation:
      'Priority depends on urgency, impact and risk, not only waiting time. A whole team locked out is high-impact and time-critical.',
    distractors: {
      a: 'Waiting longest does not make a low-impact how-to question the most urgent.',
      b: 'A tone complaint matters, but it does not block the customer from working.',
      d: 'Invoice copies are a routine request with little time pressure.',
    },
  },
  {
    id: 'Q17',
    category: 'tickets',
    difficulty: 'foundational',
    scenario: false,
    prompt: 'What is the main purpose of an internal note on a support ticket?',
    options: {
      a: 'To share context with colleagues, such as investigation steps, without sending it to the customer.',
      b: 'To send the customer a private message that the other agents on the team are unable to read.',
      c: 'To store the customer’s password so colleagues can log in to the account when they help.',
      d: 'To record personal opinions about the customer so that the next agent knows what to expect from them.',
    },
    correct: 'a',
    explanation:
      'Internal notes keep the team informed about findings, actions and next steps without that working detail going to the customer.',
    distractors: {
      b: 'Messages to customers are public replies. Internal notes are not sent to the customer.',
      c: 'Passwords should never be requested or stored in tickets.',
      d: 'Notes should be factual and professional. Customers may be entitled to see records held about them.',
    },
  },
  {
    id: 'Q18',
    category: 'tickets',
    difficulty: 'intermediate',
    scenario: false,
    prompt: 'Under good practice, when should a ticket be marked as resolved?',
    options: {
      a: "Once the agent has sent any reply that appears to answer the customer's question.",
      b: 'Once the ticket has been open for longer than the service-level target permits for its priority.',
      c: "Once the customer has gone one hour without replying to the agent's most recent response.",
      d: 'When the issue is solved and confirmed, or the agreed follow-up window ends without reply.',
    },
    correct: 'd',
    explanation:
      'Closure should reflect an actual outcome: the customer confirms, or a documented follow-up period passes after a reasonable solution was given.',
    distractors: {
      a: 'Sending a reply is not the same as resolving the issue.',
      b: 'Closing to stop the SLA clock hides a breach and misleads reporting.',
      c: 'One hour is rarely a reasonable window, and silence alone does not confirm resolution.',
    },
  },
  {
    id: 'Q19',
    category: 'tickets',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      "A ticket's resolution SLA expires in 30 minutes. You are waiting on the finance team and cannot resolve it in time. What should you do?",
    options: {
      a: 'Mark the ticket resolved now so the SLA is met, then reopen it when finance replies.',
      b: 'Tell the customer the honest status and next update time, and follow the escalation path.',
      c: 'Lower the ticket’s priority so that a longer SLA target applies to it automatically from now on.',
      d: 'Say nothing to the customer until finance replies, so that you only share facts.',
    },
    correct: 'b',
    explanation:
      'An SLA breach is better handled honestly: keep the customer informed, set expectations for the next update, and use the escalation procedure so the delay is visible and owned.',
    distractors: {
      a: 'Falsely resolving tickets corrupts metrics and misleads the customer.',
      c: 'Reclassifying to escape an SLA misrepresents the ticket’s real urgency.',
      d: 'Silence while a deadline passes damages trust. Status updates are themselves facts.',
    },
  },
  {
    id: 'Q20',
    category: 'tickets',
    difficulty: 'intermediate',
    scenario: true,
    prompt: 'A customer has emailed, chatted and called about the same issue, creating three tickets. What is the best handling?',
    options: {
      a: 'Merge or link them under one owner so the history is complete and replies stay consistent.',
      b: 'Have three agents work on the three tickets in parallel so the issue is resolved faster.',
      c: 'Close the two newest tickets without notes, since the customer will hear back on the first.',
      d: 'Reply to each ticket separately with a standard message asking the customer to use email.',
    },
    correct: 'a',
    explanation:
      'Duplicates should be consolidated under a single owner, preserving all information, so the customer gets one consistent answer.',
    distractors: {
      b: 'Parallel work duplicates effort and risks contradictory answers.',
      c: 'Closing without notes can lose information shared in those contacts.',
      d: 'Three separate replies add noise, and restricting channels does not solve the issue.',
    },
  },

  // --- CRM, support tools and documentation (4) ---------------------------
  {
    id: 'Q21',
    category: 'crm',
    difficulty: 'foundational',
    scenario: false,
    prompt: 'What is the main value of recording customer interaction history in a CRM?',
    options: {
      a: 'It allows agents to skip identity checks for customers who contact the company often.',
      b: 'It shows authorised agents what has already happened, so customers need not repeat it.',
      c: 'It provides a record that can be used to decide which customers deserve faster service.',
      d: 'It removes the need for a knowledge base, because past answers are kept in each record.',
    },
    correct: 'b',
    explanation:
      'Interaction history gives continuity: any authorised agent can pick up where the last one left off, which reduces customer effort and inconsistent answers.',
    distractors: {
      a: 'Familiarity is not verification. Identity checks still apply.',
      c: 'Prioritisation should rest on urgency, impact and agreed service levels, not on judgments recorded about people.',
      d: 'Individual records do not replace a maintained, reviewed knowledge base.',
    },
  },
  {
    id: 'Q22',
    category: 'crm',
    difficulty: 'intermediate',
    scenario: true,
    prompt:
      'A customer explains a complex problem in detail. A saved reply (macro) in your help desk partly fits. What is the best use of it?',
    options: {
      a: 'Send the macro unchanged, because approved templates guarantee consistent quality.',
      b: 'Avoid the macro entirely, because templates always feel impersonal to customers.',
      c: "Adapt the macro so it addresses the customer's specific details and questions.",
      d: 'Send the macro first, then wait to see whether the customer asks follow-up questions.',
    },
    correct: 'c',
    explanation:
      'Saved replies give accurate, consistent wording, but they must be personalised to the actual question. Adapting keeps the efficiency and the accuracy.',
    distractors: {
      a: 'An unchanged template that only partly fits leaves questions unanswered.',
      b: 'Templates are useful when tailored. Avoiding them can reduce accuracy and consistency.',
      d: 'Sending a partial answer and waiting creates avoidable back-and-forth.',
    },
  },
  {
    id: 'Q23',
    category: 'crm',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'An AI assistant in your help desk drafts a reply stating that the customer is entitled to a 30-day free extension. You cannot find this offer in any policy. What should you do?',
    options: {
      a: 'Send the draft, because the AI tool has access to more information than you do.',
      b: 'Send the draft but add a note that the offer may be subject to change at any time.',
      c: 'Delete the draft and tell the customer that automated tools cannot be trusted.',
      d: 'Check official policy, correct the draft, and report the inaccurate suggestion.',
    },
    correct: 'd',
    explanation:
      'Automated suggestions can be wrong. The agent is accountable for what is sent: verify against the authoritative source, correct it, and report the error so the tool can be fixed.',
    distractors: {
      a: 'AI tools can produce confident but false content. Unverified offers create real commitments.',
      b: 'A disclaimer does not make a false offer acceptable and still misleads the customer.',
      c: 'Criticising tools to the customer is unprofessional, and the error still goes unreported.',
    },
  },
  {
    id: 'Q24',
    category: 'crm',
    difficulty: 'intermediate',
    scenario: false,
    prompt: 'Which ticket note is most useful for the next agent who picks up the case?',
    options: {
      a: '"Can\'t log in after reset; two links expired. New link sent 14:05. Awaiting customer\'s confirmation."',
      b: '"Customer very rude and impatient again, as usual. Spent 20 minutes trying to help. Nothing worked."',
      c: '"Login problem. See the earlier emails and calls for the full story of what has happened so far."',
      d: '"Reset sent. Should be fine now, probably. Customer may call back later if it is still not working."',
    },
    correct: 'a',
    explanation:
      'A useful note is factual and specific: the problem, what was tried, what happened, the current action with a time, and what is awaited.',
    distractors: {
      b: 'It records opinions instead of facts and does not say what was tried.',
      c: 'It forces the next agent to reconstruct the case from scattered records.',
      d: 'It is vague about what was done and leaves the status uncertain.',
    },
  },

  // --- Privacy, security, ethics and professional boundaries (5) -----------
  {
    id: 'Q25',
    category: 'privacy',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      "A caller asks you to change the email address on an account. They know the account holder's name and phone number but fail the security question, and they say it is urgent. What should you do?",
    options: {
      a: 'Make the change, because knowing the name and phone number is enough to show they are the holder.',
      b: 'Make the change, but send a notification to the old email address once it is done.',
      c: 'Decline the change and explain the alternative verification route, revealing no account details.',
      d: 'Read out the email address on file so the caller can confirm whether it belongs to them.',
    },
    correct: 'c',
    explanation:
      'Changing contact details is a classic account-takeover step. Verification failed, so the change must not proceed; offer the approved alternative route without disclosing anything.',
    distractors: {
      a: 'A name and phone number are often easy to obtain and do not prove identity.',
      b: 'Notifying afterwards does not undo a takeover. The attacker already controls the account.',
      d: 'Reading out details on file discloses personal data to an unverified caller.',
    },
  },
  {
    id: 'Q26',
    category: 'privacy',
    difficulty: 'intermediate',
    scenario: true,
    prompt: 'A customer starts typing their full card number and security code into a live chat to pay a bill. What should you do?',
    options: {
      a: 'Ask them to finish typing so that you can process the payment quickly on their behalf.',
      b: 'Copy the details into the CRM notes so that the billing team can process it later on.',
      c: 'Ignore the message and continue, since the chat platform is probably already encrypted.',
      d: 'Ask them to stop, follow the redaction process, and direct them to the secure payment page.',
    },
    correct: 'd',
    explanation:
      'Card data should only go through approved, secure payment channels. Stop the disclosure, remove the data according to procedure, and direct the customer to the proper route.',
    distractors: {
      a: 'Processing card data from chat breaches payment security rules and exposes the customer to fraud.',
      b: 'Storing card numbers in notes spreads sensitive data to everyone who can read the ticket.',
      c: 'Encryption in transit does not make chat logs an acceptable place to store card data.',
    },
  },
  {
    id: 'Q27',
    category: 'privacy',
    difficulty: 'intermediate',
    scenario: true,
    prompt:
      'You receive an internal-looking email from "IT Support" asking you to confirm your help desk password through a link because of an "urgent security update". What should you do?',
    options: {
      a: "Follow the link, since the message appears to come from your own company's IT team.",
      b: "Do not use the link; report the email through your organisation's phishing-reporting process.",
      c: 'Reply to the email asking the sender to confirm that it is genuine before you proceed.',
      d: 'Forward it to your colleagues to check whether they have received the same request from IT.',
    },
    correct: 'b',
    explanation:
      'Urgency plus a request for credentials through a link is a classic phishing pattern. Do not interact with it; report it so the security team can respond.',
    distractors: {
      a: 'Sender names and branding are easily faked.',
      c: 'Replying goes to the attacker, who will simply confirm.',
      d: 'Forwarding spreads the phishing email and increases the chance that someone clicks.',
    },
  },
  {
    id: 'Q28',
    category: 'privacy',
    difficulty: 'intermediate',
    scenario: false,
    prompt:
      'Which practice best reflects the data-minimisation principle found in data protection laws such as the Nigeria Data Protection Act 2023?',
    options: {
      a: 'Collecting only the personal information needed for the specific support purpose.',
      b: 'Collecting as much information as possible in case it becomes useful at a later date.',
      c: 'Keeping every customer record permanently so that the history is never lost.',
      d: 'Asking every customer for a government ID number to make the records more accurate.',
    },
    correct: 'a',
    explanation:
      'Data minimisation means personal data should be adequate, relevant and limited to what is necessary for the purpose. Collect what you need, nothing more.',
    distractors: {
      b: 'Collecting data "just in case" is the opposite of minimisation.',
      c: 'Indefinite retention conflicts with keeping data only as long as needed.',
      d: 'Routinely collecting ID numbers without a specific need is excessive.',
    },
  },
  {
    id: 'Q29',
    category: 'privacy',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      "While helping a customer, you notice that their account shows another customer's address and order history. What should you do?",
    options: {
      a: 'Correct both customer records yourself so that each person sees the right details.',
      b: 'Tell the customer it is a display glitch and carry on helping with their request.',
      c: 'Ask the customer to delete anything they may have seen about the other person.',
      d: 'Stop, disclose nothing more, and report it at once through the incident procedure.',
    },
    correct: 'd',
    explanation:
      'This may be a personal data breach. Limit further exposure, record what you observed, and report it immediately through the authorised incident process; trained staff decide on containment and notification.',
    distractors: {
      a: 'Editing records yourself may destroy evidence and does not address the wider cause.',
      b: 'Calling it a glitch and moving on means a possible breach goes unreported.',
      c: 'This does not contain the incident and still leaves it unreported.',
    },
  },

  // --- Service recovery and customer retention (4) ------------------------
  {
    id: 'Q30',
    category: 'recovery',
    difficulty: 'foundational',
    scenario: false,
    prompt: 'What is the main goal of service recovery after a service failure?',
    options: {
      a: 'To prove to the customer that the failure was not really the company’s fault in the first place.',
      b: 'To offer compensation to every affected customer, whatever the circumstances.',
      c: 'To fix the problem and restore the customer’s trust through a fair, timely response.',
      d: 'To stop the customer from leaving by offering the largest possible discount.',
    },
    correct: 'c',
    explanation:
      'Service recovery is about correcting the failure and rebuilding trust with a response that is prompt, fair and proportionate.',
    distractors: {
      a: 'Defending the company rather than solving the problem damages trust further.',
      b: 'Compensation can help, but it should be proportionate rather than automatic.',
      d: 'Large discounts without fixing the cause are expensive and rarely restore trust.',
    },
  },
  {
    id: 'Q31',
    category: 'recovery',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'A high-value business customer has had three service outages in a month and says they are considering leaving. You can offer a standard one-month credit but nothing more. What is the best approach?',
    options: {
      a: 'Promise a larger credit to keep them, then ask your manager to approve it afterwards.',
      b: 'Acknowledge the pattern, offer what you can, and escalate the retention risk with context.',
      c: 'Offer the standard credit and close the ticket, since that is the limit of your authority.',
      d: 'Tell them every provider has outages and that switching would not solve the problem.',
    },
    correct: 'b',
    explanation:
      'Acknowledge the repeated failures honestly, provide what is within your authority, and escalate the retention risk with full context so someone with more authority can act.',
    distractors: {
      a: 'Promising unapproved terms creates a commitment the company may not honour.',
      c: 'Staying within authority is right, but closing without escalating ignores a serious, visible risk.',
      d: 'This dismisses legitimate concerns and makes leaving more likely.',
    },
  },
  {
    id: 'Q32',
    category: 'recovery',
    difficulty: 'intermediate',
    scenario: false,
    prompt: 'Why might a customer who rates a support interaction highly still leave the company soon afterwards?',
    options: {
      a: 'Because satisfaction scores are always inaccurate and should be ignored completely by the business.',
      b: 'Because customers who give high ratings are usually trying to obtain discounts.',
      c: 'Because one positive interaction may not outweigh recurring product or service problems.',
      d: 'Because leaving is only ever caused by price, which support teams cannot influence.',
    },
    correct: 'c',
    explanation:
      'Satisfaction with one contact is not the same as loyalty. If the underlying product or service keeps failing, a pleasant interaction may not keep the customer.',
    distractors: {
      a: 'Satisfaction scores are useful signals with limitations, not worthless.',
      b: 'This is an unfounded assumption about customer motives.',
      d: 'Customers leave for many reasons, including reliability and effort, which support can influence.',
    },
  },
  {
    id: 'Q33',
    category: 'recovery',
    difficulty: 'intermediate',
    scenario: true,
    prompt:
      'A customer repeatedly demands credits that exceed their total spend and is abusive to staff. Management decides not to offer further concessions. Which statement best explains this decision?',
    options: {
      a: 'Keeping a customer is not worth any cost when it harms staff, fairness, or viability.',
      b: 'Customers who complain often are always acting in bad faith and should be removed.',
      c: 'Support teams should never offer credits, because credits encourage more complaints.',
      d: 'Management should always override support staff whenever a customer complains often.',
    },
    correct: 'a',
    explanation:
      'Retention has limits. When keeping a customer means tolerating abuse, unfair concessions or unsustainable cost, declining further concessions can be the right decision.',
    distractors: {
      b: 'Frequent complaints often signal real problems. This decision rests on abuse and disproportion.',
      c: 'Proportionate credits are a legitimate recovery tool.',
      d: 'The decision supports staff; it is not a rule that management overrides them.',
    },
  },

  // --- Support metrics and quality assurance (3) --------------------------
  {
    id: 'Q34',
    category: 'metrics',
    difficulty: 'intermediate',
    scenario: true,
    prompt: "A team's average resolution time has fallen sharply, but its reopen rate has doubled. What is the most likely interpretation?",
    options: {
      a: 'Service has improved overall, because faster resolution always means better service.',
      b: 'Customers are contacting the team more often because they enjoy the faster service.',
      c: 'Tickets may be closed before issues are truly resolved, so quality may have fallen.',
      d: 'The reopen rate is unrelated to resolution time and can be ignored in this case.',
    },
    correct: 'c',
    explanation:
      'Metrics must be read together. Faster closure combined with more reopened tickets suggests premature closure: speed improved on paper while outcomes got worse.',
    distractors: {
      a: 'Speed alone does not prove quality; the reopen rate is a warning sign.',
      b: 'Reopens usually mean the problem was not solved, not that customers enjoy contacting support.',
      d: 'Reopen rate is a key check on whether fast resolutions are real.',
    },
  },
  {
    id: 'Q35',
    category: 'metrics',
    difficulty: 'foundational',
    scenario: false,
    prompt: 'What does Customer Effort Score (CES) primarily measure?',
    options: {
      a: 'How likely a customer is to recommend the company to friends or colleagues.',
      b: 'How easy or difficult it was for the customer to get their issue handled.',
      c: "How satisfied the customer was with a specific agent's friendliness and tone.",
      d: 'How many contacts the support team managed to handle during a working day.',
    },
    correct: 'b',
    explanation:
      'CES asks how much effort the customer had to spend to get help. High effort is a strong predictor of dissatisfaction and churn.',
    distractors: {
      a: 'That describes Net Promoter Score (NPS).',
      c: 'Satisfaction with an interaction is usually measured by CSAT.',
      d: 'Contact volume is an operational measure, not a customer perception score.',
    },
  },
  {
    id: 'Q36',
    category: 'metrics',
    difficulty: 'intermediate',
    scenario: true,
    prompt: 'A manager proposes ranking agents solely by their CSAT scores. What is the strongest concern?',
    options: {
      a: 'CSAT can only be collected after phone calls, not through email or chat channels.',
      b: 'CSAT measures exactly the same thing as NPS, so it adds no new information to the team at all.',
      c: 'CSAT scores are always lower for experienced agents, who handle harder tickets.',
      d: 'CSAT reflects only those who respond and can be swayed by factors agents do not control.',
    },
    correct: 'd',
    explanation:
      'CSAT is valuable but incomplete: response rates are often low, and scores reflect policy, product and pricing as well as the agent. It should be combined with quality reviews and other measures.',
    distractors: {
      a: 'CSAT surveys are commonly sent after chat and email as well as calls.',
      b: 'CSAT measures satisfaction with an interaction; NPS measures likelihood to recommend.',
      c: 'There is no such fixed rule, though ticket mix can affect scores.',
    },
  },

  // --- Escalation, teamwork and situational judgment (4) ------------------
  {
    id: 'Q37',
    category: 'judgment',
    difficulty: 'intermediate',
    scenario: true,
    prompt:
      'A customer says a colleague promised them free delivery, but this offer is not in your records or in current policy. What should you do?',
    options: {
      a: 'Honour the promise at once, since a customer would be unlikely to invent it.',
      b: 'Check the history and policy, explain the outcome honestly, and flag it internally.',
      c: 'Tell the customer your colleague made a mistake and that the promise is void.',
      d: 'Require written proof of the promise before you continue helping the customer with their request.',
    },
    correct: 'b',
    explanation:
      'Establish the facts first, then respond honestly within policy. If a colleague did give wrong information, raise it internally so it can be corrected and, where appropriate, honoured by someone with authority.',
    distractors: {
      a: 'Acting without checking can create unauthorised commitments.',
      c: 'Blaming a colleague in front of the customer is unprofessional and may be wrong.',
      d: 'Demanding proof is adversarial and ignores the records you can check yourself.',
    },
  },
  {
    id: 'Q38',
    category: 'judgment',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'A technical fault is affecting hundreds of customers. Engineering is investigating but has no estimated fix time. Which support response is best?',
    options: {
      a: 'Tell customers the fix will be ready within an hour, to reduce the volume of contacts.',
      b: 'Avoid acknowledging the issue until engineering has confirmed its exact cause.',
      c: 'Acknowledge it, share what is known, set the next update time, and avoid guessing.',
      d: 'Ask every affected customer to submit a detailed ticket so each can be investigated.',
    },
    correct: 'c',
    explanation:
      'In an incident, communicate early and honestly: confirm the issue, share what is known, commit to a time for the next update, and do not invent fix times.',
    distractors: {
      a: 'A made-up estimate will likely be missed, creating a second wave of complaints.',
      b: 'Silence leaves customers guessing and floods support with contacts.',
      d: 'For a known widespread fault, individual tickets add load without helping diagnosis.',
    },
  },
  {
    id: 'Q39',
    category: 'judgment',
    difficulty: 'intermediate',
    scenario: false,
    prompt: 'When escalating a ticket to the technical team, what should your handover include?',
    options: {
      a: 'A summary, steps already tried, evidence such as logs, and the impact on the customer.',
      b: 'A short note saying "please fix urgently" so the team knows it is a high priority.',
      c: "The customer's full contact history, password and payment details, for completeness.",
      d: "Only the customer's original message, so the technical team can interpret it alone.",
    },
    correct: 'a',
    explanation:
      'A good escalation lets the receiving team act without repeating your work: a clear summary, what has been tried, evidence and the business or customer impact.',
    distractors: {
      b: 'Urgency without information slows the receiving team down.',
      c: 'Passwords should never be collected, and payment details are not needed for most technical work.',
      d: 'Passing on the raw message without your findings wastes the investigation already done.',
    },
  },
  {
    id: 'Q40',
    category: 'judgment',
    difficulty: 'advanced',
    scenario: true,
    prompt:
      'You realise you gave a customer incorrect information yesterday, which may cause them to miss a payment deadline. What should you do?',
    options: {
      a: 'Wait to see whether the customer notices, to avoid causing any unnecessary worry.',
      b: 'Correct the information in the ticket notes without contacting the customer.',
      c: 'Ask a colleague to contact the customer so the error is not linked to you.',
      d: 'Contact the customer promptly with the correct details and tell your team lead.',
    },
    correct: 'd',
    explanation:
      'Accountability means correcting the error quickly, before it causes harm, and being transparent with your team so any consequences can be managed.',
    distractors: {
      a: 'Waiting risks the customer missing the deadline because of your error.',
      b: 'Fixing the record without telling the customer leaves them acting on wrong information.',
      c: 'Hiding responsibility undermines trust and prevents learning from the mistake.',
    },
  },
];

const byId = new Map(QUESTION_BANK.map((q) => [q.id, q]));

export function getQuestion(id: string): BankQuestion | undefined {
  return byId.get(id);
}
