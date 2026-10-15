/**
 * Everything the sponsors page shows, in one place. Before launch:
 *
 * - set each channel's `url` once the account exists (a channel without one
 *   renders as "opens at launch", never as a dead link);
 * - confirm or change the tier amounts — they are proposals;
 * - add sponsors to `SPONSORS` as they arrive.
 */

export type Tier = {
  name: string
  kind: "Recurring" | "One-time" | "Custom"
  audience: "individual" | "organisation"
  /** US dollars per `period` for recurring tiers; `null` means the sponsor sets it. */
  amount: number | null
  /** What `amount` is per; monthly unless it says otherwise. */
  period?: "month" | "year"
  text: string
  benefits: string[]
  featured?: boolean
}

export const TIERS: Tier[] = [
  {
    name: "Backer",
    kind: "Recurring",
    audience: "individual",
    amount: 5,
    text: "You use Kirana, or want it to exist.",
    benefits: [
      "Your name on this page",
      "The sponsor badge on your GitHub profile",
    ],
  },
  {
    name: "Supporter",
    kind: "Recurring",
    audience: "individual",
    amount: 25,
    text: "Helps cover CI and hosting, every month.",
    benefits: [
      "Your name and avatar on this page",
      "Your avatar in the README",
    ],
  },
  {
    name: "Donation",
    kind: "One-time",
    audience: "individual",
    amount: null,
    text: "Any amount, once, on any channel below.",
    benefits: ["Your name on this page, if you want it"],
  },
  {
    name: "Platinum sponsor",
    kind: "Recurring",
    audience: "organisation",
    amount: 100_000,
    period: "year",
    text: "For a company whose products are built on Kirana, and that wants it to outlast any one maintainer.",
    benefits: [
      "The first and largest logo on the homepage, beside every docs page, on this page and in the README",
      "Named in every release note",
      "A quarterly call with the maintainers about the roadmap: you are heard, and decisions stay public",
      "Help moving one of your codebases onto Kirana, scoped together",
    ],
  },
  {
    name: "Bronze sponsor",
    kind: "Recurring",
    audience: "organisation",
    amount: 100,
    text: "Your team builds on Kirana and wants it maintained.",
    benefits: [
      "A small logo on this page and in the README",
      "A link to your site",
    ],
  },
  {
    name: "Silver sponsor",
    kind: "Recurring",
    audience: "organisation",
    amount: 500,
    text: "Kirana is part of how your team ships.",
    benefits: [
      "A medium logo on this page and in the README",
      "Your logo on the homepage",
      "A link to your site",
    ],
  },
  {
    name: "Gold sponsor",
    kind: "Recurring",
    audience: "organisation",
    amount: 2_000,
    text: "Funds a meaningful share of maintainer time.",
    benefits: [
      "A large logo on the homepage, this page and the README",
      "Your logo beside every docs page",
      "A link to your site",
    ],
    featured: true,
  },
  {
    name: "Partner",
    kind: "Custom",
    audience: "organisation",
    amount: null,
    text: "You need something specific: an adapter, a framework, a migration.",
    benefits: [
      "Scope, schedule and amount agreed in writing",
      "The placements of the tier your amount matches",
    ],
  },
]

export type Term = { title: string; text: string }
export type Terms = { covers: Term[]; excludes: Term[] }

/**
 * What a sponsorship buys and what it does not. Shown after the tiers, so a
 * company reads the limits before it pays, not after.
 */
export const TERMS: Terms = {
  covers: [
    {
      title: "Maintenance",
      text: "Of the MIT-licensed compiler and packages, spent in the order under “What funding unlocks”.",
    },
    {
      title: "Your placements",
      text: "The ones your tier lists, for as long as the sponsorship runs.",
    },
    {
      title: "A voice on the roadmap",
      text: "Platinum: a quarterly call with the maintainers. You are heard; what is decided is decided in public.",
    },
    {
      title: "Agreed work",
      text: "Partner: the scope, schedule and invoice you agree in writing.",
    },
    {
      title: "A public ledger",
      text: "Where the channel keeps one. Open Collective publishes every contribution and expense.",
    },
  ],
  excludes: [
    {
      title: "Control of the roadmap",
      text: "No say over the roadmap, the API or the diagnostics. Those are decided in public issues, on technical grounds, for every user, Platinum included.",
    },
    {
      title: "Promised features or dates",
      text: "No feature, fix or release date is promised, unless it is written into a Partner agreement.",
    },
    {
      title: "An SLA or a warranty",
      text: "The MIT licence's “as is” still applies. No sponsorship buys a response time or a support contract.",
    },
    {
      title: "Endorsement",
      text: "A logo says you fund Kirana, not that Kirana recommends your product.",
    },
    {
      title: "Exclusivity",
      text: "Competitors may sponsor too, and are shown by the same rules.",
    },
    {
      title: "Ads or tracking",
      text: "A placement is your logo and a plain link; nothing loads from your servers.",
    },
    {
      title: "A permanent placement",
      text: "Placements end when the sponsorship does, and one may be declined or removed if it would harm the people who read these docs.",
    },
  ],
}

export type Channel = {
  name: string
  text: string
  /** Set once the account exists. */
  url?: string
}

export type ChannelGroup = {
  title: string
  text: string
  channels: Channel[]
}

export const CHANNELS: ChannelGroup[] = [
  {
    title: "From anywhere",
    text: "Monthly or one-time, by card.",
    channels: [
      {
        name: "GitHub Sponsors",
        text: "No fee on sponsorships from personal accounts.",
      },
      {
        name: "Open Collective",
        text: "Every contribution and expense on a public ledger.",
      },
      {
        name: "Polar",
        text: "Card payments, with receipts from Polar as the seller.",
      },
    ],
  },
  {
    title: "For companies",
    text: "When a card is not how your finance team pays.",
    channels: [
      {
        name: "Open Collective invoice",
        text: "Pay a US non-profit fiscal host against its invoice.",
      },
      {
        name: "GitHub invoiced billing",
        text: "Sponsor from your GitHub organisation on its existing invoice.",
      },
    ],
  },
]

export type Goal = { title: string; text: string; items: string[] }

/** What funding unlocks, in the order it would be spent. */
export const GOALS: Goal[] = [
  {
    title: "Keep the lights on",
    text: "The costs that exist whether or not anyone writes code.",
    items: [
      "CI minutes for every pull request across eight platforms",
      "Domains, hosting for the docs and the playground",
      "npm organisation and release signing",
    ],
  },
  {
    title: "Ship it safely",
    text: "What a 1.0 needs before companies can depend on it.",
    items: [
      "Trademark clearance for the name",
      "An independent security review of the evaluator",
      "Benchmarks on dedicated hardware instead of shared CI",
    ],
  },
  {
    title: "Maintainer time",
    text: "The largest cost, and the one that decides the pace.",
    items: [
      "Part-time, then full-time maintenance",
      "Publishing and maintaining the editor extensions",
      "Answering issues within days, not weeks",
    ],
  },
]

export type Sponsor = {
  name: string
  url?: string
  /** Path under `public/`, square for individuals, wide for organisations. */
  image?: string
  tier: Tier["name"]
}

/** Empty until the first sponsor: the page shows an invitation in each slot. */
export const SPONSORS: Sponsor[] = []

/** Grouped by topic, like the homepage's questions. */
export const FAQ: {
  topic: string
  items: { question: string; answer: string }[]
}[] = [
  {
    topic: "The project",
    items: [
      {
        question: "Will Kirana stay free?",
        answer:
          "The compiler and the packages in this repository are MIT licensed. Sponsorship pays for their maintenance; it does not buy features away from anyone.",
      },
      {
        question: "Where does the money go?",
        answer:
          "To the goals above, in that order: running costs first, then what a 1.0 needs, then maintainer time.",
      },
    ],
  },
  {
    topic: "Paying",
    items: [
      {
        question: "Which channel should I use?",
        answer:
          "Whichever is easiest for you. GitHub Sponsors takes no fee from personal accounts; Open Collective publishes every expense; Polar issues receipts as the seller.",
      },
      {
        question: "My company needs an invoice or a contract.",
        answer:
          "Sponsor through Open Collective: Open Source Collective, a US non-profit, invoices your company and publishes the payment on the public ledger. GitHub Sponsors can also bill your GitHub organisation on its existing invoice. Partner work is agreed in writing, case by case.",
      },
      {
        question: "Can I sponsor anonymously?",
        answer:
          "Yes. GitHub Sponsors lets you sponsor privately and Open Collective lets you contribute as incognito; nothing is listed here without your say.",
      },
    ],
  },
]
