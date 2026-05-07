# Round 2 Concept: Multi Habit, Grass Views, and Toss Point Loop

Date: 2026-05-07
Status: concept/spec drafted after owner request

## Owner Request

- Support multiple habits.
- Add monthly and yearly `잔디` views similar to a contribution heatmap.
- Research Apps in Toss and plan how Toss Point promotions could be used.

## Image Note

The Slack image could not be downloaded because the Slack token lacks file access scope. The request is interpreted as a GitHub-style contribution heatmap/grass view.

## Apps in Toss Research Summary

Sources checked: official Apps in Toss developer center.

Key facts:
- Apps in Toss is an app-in-app platform that exposes partner services inside the Toss app.
- It provides SDK/API/UI components and supports login, payment, authentication, marketing, monetization, and exposure through Toss surfaces.
- API calls require mTLS for server-to-server communication.
- Toss Point promotion APIs exist for non-game miniapps, and promotion rewards can be granted based on specific user actions.
- Promotion budgets are funded through Biz Wallet and budget shortage can create CS risk.
- Internal miniapp rewards should not be called `포인트` if they are not actual Toss Points, to avoid user confusion.

## Product Direction

Move from `single representative habit` to `lightweight habit board`.

### Round 2 MVP Scope

P0:
- Multiple habits list.
- Create/edit/archive each habit.
- Check/uncheck each habit for today.
- Per-habit streak and total completed count.
- Overall today completion summary.
- Monthly grass view for selected habit and all habits combined.
- Yearly grass view for selected habit and all habits combined.

P1:
- Habit categories: health, money, study, lifestyle.
- Toss-context recommended habits: 소비 내역 확인하기, 저축 목표 보기, 불필요한 소비 안 하기.
- Month navigation.
- Year selector.
- Completion intensity colors.

P2:
- Point mission rules.
- Weekly challenge.
- Recovery streak.
- Smart message/reminder integration.

## UX Structure

### Home

- Header: 오늘습관
- Summary card: 오늘 N개 중 M개 완료
- Habit cards:
  - habit title
  - today check button
  - streak
  - small week strip
- CTA: 습관 추가

### Grass Tab

- Toggle: 월 / 년
- Scope selector: 전체 / 습관별
- Monthly view:
  - calendar grid
  - color intensity by completed habit count
- Yearly view:
  - 53-week contribution-style grid
  - tooltip/detail sheet on day tap

### Point Mission Tab / Banner

- Shows point-eligible missions only after policy/contract readiness.
- Copy should use `토스 포인트` only for actual Toss Point rewards.
- Non-monetary in-app progress should be called `성취`, `배지`, or `루틴 점수`, not `포인트`.

## Toss Point Strategy

### Recommended Reward Rules

Use sparse, budget-controlled rewards instead of paying every check.

1. First habit creation bonus
   - Example: first habit created and first check completed.
   - Purpose: activation.
   - Reward: small one-time Toss Point amount.

2. Weekly completion mission
   - Example: complete at least 1 habit on 5 days in a week.
   - Purpose: D7 retention.
   - Reward: limited weekly bonus.

3. Monthly consistency mission
   - Example: complete at least 20 days in a month.
   - Purpose: long-term retention.
   - Reward: badge + optional Toss Point lottery/limited bonus.

4. Finance habit mission
   - Example: check spending, review saving goal, no unnecessary spending day.
   - Purpose: stronger Toss fit.
   - Reward: only for approved mission actions.

### Guardrails

- Do not reward every habit check; it can drain budget and encourage low-quality taps.
- Cap rewards by user/day/week/month.
- Keep idempotency keys per reward event.
- Track reward state separately from habit completion.
- Handle PENDING/SUCCESS/FAILED states explicitly.
- Hide or disable reward claims if budget/promotion is inactive.
- Avoid guilt or gambling-like language.

## Technical Plan

### Database

Replace single active habit assumptions with:

- habits
  - id
  - title
  - category
  - color
  - sort_order
  - created_at
  - archived_at
- habit_checks
  - id
  - habit_id
  - check_date
  - is_completed
  - updated_at
- point_reward_events
  - id
  - user_key_hash/local_user_id
  - reward_type
  - reward_date
  - promotion_code
  - promotion_key
  - amount
  - status: LOCAL_ELIGIBLE / REQUESTED / PENDING / SUCCESS / FAILED
  - created_at
  - updated_at

### API

- GET /api/habits
- POST /api/habits
- PATCH /api/habits/:id
- DELETE /api/habits/:id
- PUT /api/habits/:id/check/today
- GET /api/stats/grass?range=month|year&habitId=all|id
- POST /api/rewards/claim

### Frontend Components

- HabitBoard
- HabitCard
- HabitCreateSheet
- GrassHeatmap
- MonthGrassView
- YearGrassView
- PointMissionCard

## Open Decisions

1. Should Round 2 implement month/year grass first, or multiple habits first?
   - Recommendation: multiple habits first, then grass.
2. Should Toss Point be a launch MVP feature or post-MVP experiment?
   - Recommendation: post-MVP experiment until Apps in Toss contract/promotion setup is ready.
3. Should finance habits be emphasized over general health/study habits?
   - Recommendation: offer both, but make finance habits the default recommendations for Toss fit.
