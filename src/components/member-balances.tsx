import type { Member } from "@/lib/types";
import { formatCurrency } from "@/lib/calculations";

type Balance = { memberId: string; amountCents: number };

function signedCurrency(amountCents: number) {
  const sign = amountCents > 0 ? "+" : amountCents < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(amountCents))}`;
}

function balanceState(amountCents: number) {
  return amountCents > 0 ? "Alacaklı" : amountCents < 0 ? "Borçlu" : "Dengede";
}

export default function MemberBalances({
  members,
  balances,
  currentMemberId,
}: {
  members: Member[];
  balances: Balance[];
  currentMemberId: string;
}) {
  const balanceById = new Map(balances.map((balance) => [balance.memberId, balance.amountCents]));

  if (members.length === 0) return <p className="balance-empty">Henüz aktif üye yok.</p>;

  return (
    <ul className="member-balance-list" aria-label="Ev arkadaşlarının net bakiyeleri">
      {members.map((member) => {
        const amountCents = balanceById.get(member.id) ?? 0;
        const state = balanceState(amountCents);

        return (
          <li className="member-balance-row" key={member.id}>
            <span className="member-balance-copy">
              <strong>{member.name}{member.id === currentMemberId ? <span className="member-you">Sen</span> : null}</strong>
              <span>{state}</span>
            </span>
            <b className={amountCents > 0 ? "balance-positive" : amountCents < 0 ? "balance-negative" : "balance-even"}>
              {signedCurrency(amountCents)}
            </b>
          </li>
        );
      })}
    </ul>
  );
}
