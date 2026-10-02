import { amountToInteger } from '@actual-app/core/shared/util';
import type {
  CategoryEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import type { StatementRow } from './toImportTransactions';

export type CategorySource = 'rule' | 'guess' | 'user';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Well-known Czech merchants and words, mapped to category names a
 * budget may use (Czech and English). Only used when no rule of the
 * budget assigns a category.
 */
const merchantCategories: Array<{ names: string[]; pattern: RegExp }> = [
  {
    names: ['potraviny', 'nakupy', 'jidlo', 'groceries', 'food'],
    pattern:
      /\b(albert|lidl|billa|kaufland|tesco|penny|globus|makro|rohlik|kosik|coop|hruska|potraviny|zabka|norma|flop|jip|spar|delmart)\b/,
  },
  {
    names: [
      'restaurace',
      'jidlo venku',
      'stravovani',
      'restaurants',
      'dining',
      'eating out',
      'food',
    ],
    pattern:
      /\b(restaurace|restaurant|bistro|kavarna|cafe|caffe|coffee|starbucks|costa|mcdonald|kfc|burger|pizza|wolt|foodora|bolt food|dameje|bageterie|pekarna|cukrarna|hospoda|pivnice)\b/,
  },
  {
    names: [
      'doprava',
      'auto',
      'pohonne hmoty',
      'transport',
      'transportation',
      'car',
      'fuel',
    ],
    pattern:
      /\b(benzina|orlen|shell|omv|mol|eurooil|tank ono|cerpaci|regiojet|leo express|ceske drahy|cd\.cz|litacka|dpp|idos|uber|bolt|liftago|parkovani|parking|dalnicni)\b/,
  },
  {
    names: ['bydleni', 'najem', 'housing', 'rent', 'home'],
    pattern:
      /\b(najem|najemne|svj|hypoteka|rent|ikea|hornbach|obi|bauhaus|mountfield)\b/,
  },
  {
    names: ['energie', 'elektrina', 'plyn', 'sluzby', 'bills', 'utilities'],
    pattern:
      /\b(pre|cez|innogy|e\.?on|ppas|veolia|vodafone|t-mobile|tmobile|o2|nordic telecom|internet|elektrina|plyn|voda)\b/,
  },
  {
    names: ['zdravi', 'lekarna', 'health', 'medical'],
    pattern:
      /\b(lekarna|dr\.?\s?max|benu|pilulka|nemocnice|poliklinika|zubar|lekar|pharmacy)\b/,
  },
  {
    names: [
      'zabava',
      'predplatne',
      'volny cas',
      'entertainment',
      'subscriptions',
      'fun',
    ],
    pattern:
      /\b(spotify|netflix|hbo|disney|youtube|apple\.com|google play|steam|playstation|xbox|kino|cinema|cinestar|divadlo|ticketportal|goout|vstupenky)\b/,
  },
  {
    names: ['obleceni', 'clothing', 'clothes', 'shopping'],
    pattern:
      /\b(zara|h&m|reserved|primark|deichmann|ccc|decathlon|sportisimo|about you|zalando|answear|c&a)\b/,
  },
  {
    names: ['hotovost', 'vybery', 'cash'],
    pattern: /\b(bankomat|atm|vyber hotovosti|vyber z bankomatu)\b/,
  },
];

/** A category for well-known merchants, if the budget has a fitting one. */
export function guessCategoryId(
  text: string,
  categories: Pick<CategoryEntity, 'id' | 'name' | 'hidden'>[],
): string | null {
  const normalizedText = normalize(text);
  const byName = new Map(
    categories
      .filter(category => !category.hidden)
      .map(category => [normalize(category.name), category.id]),
  );
  for (const { names, pattern } of merchantCategories) {
    if (!pattern.test(normalizedText)) {
      continue;
    }
    for (const name of names) {
      const id = byName.get(name);
      if (id) {
        return id;
      }
    }
  }
  return null;
}

/** The existing payee with the same name, so its rules apply. */
export function findPayeeId(
  name: string,
  payees: Pick<PayeeEntity, 'id' | 'name' | 'transfer_acct'>[],
): string | null {
  const normalizedName = normalize(name);
  if (normalizedName === '') {
    return null;
  }
  return (
    payees.find(
      payee => !payee.transfer_acct && normalize(payee.name) === normalizedName,
    )?.id ?? null
  );
}

type RunRules = (transaction: TransactionEntity) => Promise<TransactionEntity>;

/**
 * Suggest a category for every row: first from the budget's rules (the
 * same ones the import applies, including categories learned from earlier
 * transactions of a payee), then from well-known merchants.
 */
export async function suggestCategories(
  rows: StatementRow[],
  {
    accountId,
    categories,
    payees,
    runRules,
    decimalPlaces = 2,
  }: {
    accountId: string;
    decimalPlaces?: number;
    categories: Pick<CategoryEntity, 'id' | 'name' | 'hidden'>[];
    payees: Pick<PayeeEntity, 'id' | 'name' | 'transfer_acct'>[];
    runRules: RunRules;
  },
): Promise<StatementRow[]> {
  return Promise.all(
    rows.map(async row => {
      if (row.categorySource === 'user') {
        return row;
      }
      let category: string | null = null;
      try {
        const afterRules = await runRules({
          id: `pdf-import-${row.id}`,
          account: accountId,
          date: row.date,
          amount: amountToInteger(row.amount ?? 0, decimalPlaces),
          payee: findPayeeId(row.payee, payees),
          imported_payee: row.payee,
          notes: row.notes,
        });
        category = afterRules.category ?? null;
      } catch (error) {
        console.error('Running rules for an imported row failed:', error);
      }
      if (category) {
        return { ...row, category, categorySource: 'rule' as const };
      }
      const guessed = guessCategoryId(`${row.payee} ${row.notes}`, categories);
      return guessed
        ? { ...row, category: guessed, categorySource: 'guess' as const }
        : { ...row, category: null, categorySource: undefined };
    }),
  );
}
