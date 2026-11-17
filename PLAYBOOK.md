# The Parmarpro playbook

How the business runs: who to target, what to send, what to say on the call, and how to deliver. The website in this repo is the tool. This is how to use it.

---

## 1. The model in one line

**Give away the diagnosis and the design. Sell the doing.**

For each clinic you build a finished preview of their new website plus a growth plan with copy-paste scripts. That's the "70% free". You charge for the part that takes time every week: putting the site live, making the Google changes, sending the review requests and reminders, and reporting. That's the "30%".

### Why this works
- **It skips the trust problem.** A cold message saying "I do websites" gets ignored. "I already built yours, here it is" gets opened.
- **It's specific.** The plan names *their* rating, *their* review count and *their* competitors. Generic agencies can't do that at scale; you can, because each preview is just one JSON file.
- **The risk is on you, not them.** That's Hormozi's value equation at work: raise the perceived chance it works (they can see it) and cut their time and effort (it's already done).

### Where it breaks (and the fixes)
| Risk | Fix |
|---|---|
| They take the free plan and do it themselves. | Fine. Most busy dentists won't. The ones who do may refer you. Never hold back the scripts; generosity is the marketing. |
| "70% free / 30% paid" sounds like they're paying for leftovers. | Don't say "30%" to clients. Say "the plan is yours free; we charge to run it every week." Price on outcomes (patients), not on percentage of work. |
| A preview of their business feels intrusive. | Every preview is labelled as a concept by Parmarpro, hidden from Google, and removable on request in 24 hours. Honour that every time. |
| You build 50 previews and nobody replies. | Previews aren't the bottleneck; **outreach volume and follow-up** are. See the numbers in section 3. |

---

## 2. Who to target

Pick **one area at a time** (e.g. Andheri West). Then use your local knowledge, go in person, and reuse the same competitor data across several clinics.

**Good targets** (on Google Maps, collected by hand; don't scrape with bots, it breaks Google's terms):
- Independent clinics with 1–2 dentists. Avoid chains, which have marketing teams.
- **No website**, or a broken or outdated one.
- 4.0–4.7★ with **20–150 reviews**: good enough to be real, small enough to need help.
- Owner not replying to reviews, few photos, missing hours.

**Collect per clinic (about 10 minutes):** name, address, phone, rating, review count, hours, services listed, 2–3 short real review quotes, photo count, whether reviews get replies, whether a website is linked, plus the 2–3 busiest clinics within about 1 km (their rating and review count).

---

## 3. The numbers

Track these in a Google Sheet (one row per clinic: date, area, preview link, contacted on, follow-ups, replied, call, closed, ₹).

Hormozi's "Rule of 100": do 100 primary actions every day (messages, follow-ups, visits) for 100 days before judging the results. Build up to it, starting with this **daily minimum**:
- Build **5 previews** (with Claude this takes about 15 minutes each).
- Send **20 first messages** (preview links) and all follow-ups due.
- Visit **2–3 clinics in person** if you're in the area. Showing the preview on your phone at the reception desk is the strongest move you have.

**What to expect (assumptions, not facts; measure your own):** for every 100 previews sent, maybe 10–20 replies, 3–8 calls and 1–3 clients. If replies are under 5%, change the first message. If calls don't close, change the offer or the call, not the website.

---

## 4. Outreach scripts

Send messages one at a time, by hand, personalised. **Never bulk-message on WhatsApp.** Unsolicited broadcasts get numbers banned and burn the brand. Email and Instagram DMs are fine as well.

### First message (WhatsApp, Instagram DM or email)
> Hi Dr. {Name}, I'm Vivek from Parmarpro. I was looking at dental clinics in {area} and noticed {Clinic} doesn't have a website on its Google profile, so I built one for you: {preview link}
>
> It's a private preview (not public), plus a short plan for getting more patients from Google, with scripts you can use today. Free, no catch. If you'd like it live, just reply.

Swap the hook for whatever is most true for that clinic: "you have 74 reviews and the clinic down the road has 412", "nobody's replying to your reviews", and so on.

### Follow-ups (same thread)
- **Day 3:** "Hi Dr. {Name}, did you get a chance to look? Even if you don't need us, the review script in section 3 of the plan is worth 5 minutes."
- **Day 7:** One specific number from their plan. "Quick one: the clinic 400 m from you gets ~6× the reviews. The fastest fix is the review message in your plan."
- **Day 14 (last):** "Closing the loop. I'll keep your preview up for another 2 weeks in case it's useful, then take it down. All the best."

### Walk-in (the highest-converting option)
Go at a quiet time (11 am–12 pm), ask for the doctor or the clinic manager, and show the preview on your phone: "I made this for your clinic. Takes 30 seconds to look at." Leave the link on WhatsApp.

---

## 5. The 15-minute call

1. **Their reaction (2 min):** "What did you think of the site?" Let them talk.
2. **Their goal (3 min):** "If we could bring in more of one kind of patient, which would it be? Check-ups? Implants? Aligners?" Note the high-value treatments.
3. **Two findings (3 min):** Pick the two worst items from their plan and say what each costs them. For example: "Calls during treatment go unanswered, so those patients try the next clinic."
4. **The offer (4 min):** Launch (one-time) puts everything live within 7 days, or Launch is free. Grow (monthly) runs it every week, month-to-month, cancel with one message. Do the maths with them: "At ~₹2,500 a patient, two extra patients a month covers Grow."
5. **The ask (3 min):** "Shall we put it live this week?" If yes: take 50% of Launch upfront by UPI and book a 30-minute onboarding.

**Your first 3–5 clients:** offer a founding price in exchange for a testimonial and permission to show their site under "Selected work" (`"showcase": true`). Raise prices after that.

---

## 6. Delivery checklists (mostly free tools)

### Launch (one-time)
- [ ] Domain registered **in the clinic's name** (~₹700–1,200/yr for .in or .com).
- [ ] `node src/export.mjs <slug> theirdomain.in` → new GitHub repo → Pages on → DNS records at the registrar.
- [ ] Google Business Profile: get added as a **manager** from their account (never ask for passwords). Work through the 10-point checklist from their plan.
- [ ] WhatsApp Business app on the clinic phone: profile, catalogue of treatments, greeting and away messages, quick replies (`/book`, `/location`, `/timings`).
- [ ] Review QR card (free in Canva) for the reception desk, pointing to their Google review link.
- [ ] Before/after screenshot of their profile for your own case study.

### Grow (monthly)
- [ ] Clinic shares each day's patient list (name + number) in a WhatsApp group with you, or the receptionist sends the review message themselves from the template.
- [ ] Review request to every patient seen. Draft replies to new reviews within 48 hours.
- [ ] One Google post a week, plus new photos monthly.
- [ ] Reminder messages the day before appointments.
- [ ] Recall: message patients 6+ months since their last visit, about 10 a day.
- [ ] 1st of the month: a one-page scoreboard (Google profile views, calls, direction requests, WhatsApp chats, new reviews, rating). Google Business Profile → Performance has most of these for free.

---

## 7. Rules that protect the brand

1. **Previews are labelled concepts, hidden from Google, and removed within 24 hours of asking.** Never present one as the clinic's official site.
2. **Only real reviews.** Never write or buy reviews, and send review requests to *every* patient. Google prohibits asking only happy customers ("review gating"), so the templates are worded for everyone.
3. **Keep copy factual.** Dentists in India are bound by the Dental Council of India's ethics rules, which restrict self-promotion. That's why the templates avoid "best dentist", discount bait and guaranteed results. If a client wants claims like that, steer them back to plain facts.
4. **Patient data is sensitive** (India's DPDP Act applies). Take only what you need (name + number for messages), don't store it in this repo, and delete it when a client leaves.
5. **One-to-one messages only.** No scraped lists, no WhatsApp blasts.
6. **Under-promise.** Guarantee only what you control: launch dates, response times, monthly reports. Never promise patient numbers.

---

## 8. Mindset

- **Volume beats talent early on.** Whoever sends the most good previews wins this market.
- **Give value first, without strings.** The plan must be useful even if they never pay. That's what makes people trust the paid part.
- **One niche, one city, one offer** until it works. Then raise prices, then add an area, then (maybe) a second niche.
- **Measure, don't guess.** If the reply rate or close rate is low, change one thing at a time and track it in the sheet.
