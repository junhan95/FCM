"use client";

import type { DictKey } from "@/lib/i18n";

/**
 * 매입 견적 표(Fire & Gas · Purchased Parts · E-Drive)의 공통 열 정의.
 * 카드가 나뉘어도 세로줄이 일직선이 되도록 한곳에서 관리한다.
 */
const QUOTE_COLS = ["96px", "auto", "72px", "112px", "112px", "118px", "118px"];
/** 줄 삭제 버튼이 붙는 표는 오른쪽 끝에 한 칸을 더 쓴다 */
const ACTION_COL = "40px";

export const QUOTE_COL_COUNT = QUOTE_COLS.length;

export function QuoteCols({ actions = false }: { actions?: boolean }) {
  const cols = actions ? [...QUOTE_COLS, ACTION_COL] : QUOTE_COLS;
  return (
    <colgroup>
      {cols.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

export function QuoteHead({ t, actions = false }: { t: (k: DictKey) => string; actions?: boolean }) {
  return (
    <thead>
      <tr>
        <th>{t("fgRef")}</th>
        <th className="!text-left">{t("fgDesc")}</th>
        <th>{t("fgQty")}</th>
        <th>{t("fgUnitCost")}</th>
        <th>{t("fgTotalCost")}</th>
        <th>{t("fgSales")}</th>
        <th>{t("fgOffer")}</th>
        {actions && <th />}
      </tr>
    </thead>
  );
}
