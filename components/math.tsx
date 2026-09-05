'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- HTML fraction layout uses the accessible math role and a full spoken equation label. */

function tokens(value: string) {
  return value.match(/\d+\/\d+|\d+(?:\.\d+)?|[a-z]|[^\sa-z\d]/gi) || [];
}
function unchanged(previous: string[], current: string[]) {
  const table = Array.from({ length: previous.length + 1 }, () =>
    Array<number>(current.length + 1).fill(0),
  );
  for (let i = 1; i <= previous.length; i++)
    for (let j = 1; j <= current.length; j++)
      table[i][j] =
        previous[i - 1] === current[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
  const same = new Set<number>();
  let i = previous.length,
    j = current.length;
  while (i > 0 && j > 0) {
    if (previous[i - 1] === current[j - 1]) {
      same.add(j - 1);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) i--;
    else j--;
  }
  return same;
}
export function MathText({
  value,
  previous,
  className = '',
}: {
  value: string;
  previous?: string;
  className?: string;
}) {
  const parts = tokens(value);
  const same = previous ? unchanged(tokens(previous), parts) : null;
  return (
    <span
      className={`math math-expression ${className}`}
      role="math"
      aria-label={value}
    >
      <span className="math-visual" aria-hidden="true">
        {parts.map((part, i) => (
          <span
            key={`${i}-${part}`}
            className={`math-token ${/^[a-z]$/i.test(part) ? 'variable' : ''} ${/^[+=×÷]$/.test(part) || (part === '-' && i > 0 && parts[i - 1] !== '(') ? 'operator' : ''} ${same && !same.has(i) ? 'changed' : ''}`}
          >
            {/^\d+\/\d+$/.test(part) ? (
              <span className="fraction">
                <span>{part.split('/')[0]}</span>
                <span>{part.split('/')[1]}</span>
              </span>
            ) : part === '-' ? (
              '−'
            ) : (
              part
            )}
          </span>
        ))}
      </span>
    </span>
  );
}
