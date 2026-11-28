/* global localStorage */
import { test, expect } from '@playwright/test';

const CARD_THEMES = [
  { id: 'deck1', name: 'Bộ bài số 1 (Minh họa)' },
  { id: 'deck2', name: 'Bộ bài số 2 (Cổ điển)' },
  { id: 'deck3', name: 'Bộ bài số 3 (Đêm Neon)' },
];

const TABLE_THEMES = [
  { id: 'pastel-yellow', name: 'Bàn Vàng Pastel' },
  { id: 'pastel-pink', name: 'Bàn Hồng Pastel' },
  { id: 'pastel-green', name: 'Bàn Xanh Lá Pastel' },
  { id: 'pastel-blue', name: 'Bàn Xanh Dương Pastel' },
];

async function openThemePicker(page) {
  const trigger = page
    .locator('.btn-theme-picker, .theme-picker-trigger, .game-screen__utility-btn[aria-label*="giao diện"]')
    .first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.locator('.theme-picker-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeThemePicker(page) {
  const dialog = page.locator('.theme-picker-dialog');
  await page.locator('.theme-picker-footer__close-btn').click();
  await expect(dialog).toBeHidden();
}

async function startTwoPlayerGame(browser) {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();

  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  // 1. Host creates room
  await hostPage.goto('/');
  await hostPage.locator('#player-name').fill('Alice');
  await hostPage.locator('.home-btn-create').click();

  const hostCodeDisplay = hostPage.locator('.lobby-code-display');
  await expect(hostCodeDisplay).toBeVisible();
  await expect(hostCodeDisplay).toHaveText(/^[A-Z0-9]{5}$/);
  const roomCode = (await hostCodeDisplay.innerText()).trim();

  // 2. Guest joins room
  await guestPage.goto('/');
  await guestPage.locator('#player-name').fill('Bob');
  await guestPage.locator('#join-code').fill(roomCode);
  await guestPage.locator('.home-btn-join').click();

  await expect(hostPage.locator('.lobby-player-item')).toHaveCount(2);
  await expect(guestPage.locator('.lobby-player-item')).toHaveCount(2);

  // 3. Host starts game
  const startBtn = hostPage.locator('.lobby-btn-start');
  await expect(startBtn).toBeEnabled();
  await startBtn.click();

  await expect(hostPage.locator('.game-screen')).toBeVisible();
  await expect(guestPage.locator('.game-screen')).toBeVisible();

  return { hostContext, guestContext, hostPage, guestPage };
}

test.describe('New cards & theme switcher E2E tests', () => {
  test('selects all card and table themes in ThemePicker and persists across reload', async ({ page }) => {
    await page.goto('/');

    const dialog = await openThemePicker(page);

    // Verify all 3 card themes can be selected and persisted
    for (const theme of CARD_THEMES) {
      const option = dialog.locator('.theme-picker-option', { hasText: theme.name });
      await expect(option).toBeVisible();
      await option.click();
      await expect(option).toHaveAttribute('aria-pressed', 'true');

      const stored = await page.evaluate(() => localStorage.getItem('meo-no:cardTheme'));
      expect(stored).toBe(theme.id);
    }

    // Verify all 4 table themes can be selected and persisted
    for (const theme of TABLE_THEMES) {
      const option = dialog.locator('.theme-picker-option', { hasText: theme.name });
      await expect(option).toBeVisible();
      await option.click();
      await expect(option).toHaveAttribute('aria-pressed', 'true');

      const stored = await page.evaluate(() => localStorage.getItem('meo-no:tableTheme'));
      expect(stored).toBe(theme.id);
    }

    // Pick non-default themes (deck2 + pastel-yellow), close, reload, and verify persistence
    await dialog.locator('.theme-picker-option', { hasText: 'Bộ bài số 2 (Cổ điển)' }).click();
    await dialog.locator('.theme-picker-option', { hasText: 'Bàn Vàng Pastel' }).click();
    await closeThemePicker(page);

    await page.reload();

    const storedAfterReload = await page.evaluate(() => ({
      cardTheme: localStorage.getItem('meo-no:cardTheme'),
      tableTheme: localStorage.getItem('meo-no:tableTheme'),
    }));
    expect(storedAfterReload).toEqual({
      cardTheme: 'deck2',
      tableTheme: 'pastel-yellow',
    });

    const reopenedDialog = await openThemePicker(page);
    await expect(
      reopenedDialog.locator('.theme-picker-option', { hasText: 'Bộ bài số 2 (Cổ điển)' })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      reopenedDialog.locator('.theme-picker-option', { hasText: 'Bàn Vàng Pastel' })
    ).toHaveAttribute('aria-pressed', 'true');
    await closeThemePicker(page);

    // Toggle language VI -> EN and verify localized UI + persistence
    const langBtn = page.getByTestId('lang-toggle-btn');
    await expect(langBtn).toBeVisible();
    await expect(langBtn).toContainText('VI');
    await langBtn.click();
    await expect(langBtn).toContainText('EN');
    await expect(page.locator('.home-btn-create')).toHaveText('Create room');

    await page.reload();
    await expect(page.getByTestId('lang-toggle-btn')).toContainText('EN');
    await expect(page.locator('.home-btn-create')).toHaveText('Create room');
  });

  test('renders card art images with naturalWidth > 0 on deck1 and switches to vector cards & pastel-pink table', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage } = await startTwoPlayerGame(browser);

    try {
      // Wait for hand cards to render on host screen
      const handCards = hostPage.locator('.hand-container .card');
      await expect(handCards.first()).toBeVisible();
      const cardCount = await handCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Verify default deck1 renders <img class="card__art-img"> with complete === true && naturalWidth > 0
      const artImages = hostPage.locator('.hand-container .card img.card__art-img');
      await expect(artImages).toHaveCount(cardCount);
      await expect(hostPage.locator('.hand-container .card .card__name-strip')).toHaveCount(0);

      for (let i = 0; i < cardCount; i++) {
        const img = artImages.nth(i);
        await expect(img).toBeVisible();
        await expect
          .poll(async () =>
            img.evaluate((el) => el.complete && el.naturalWidth > 0)
          )
          .toBe(true);
      }

      // Open ThemePicker inside Game, switch cardTheme to deck2 (vector) and tableTheme to pastel-pink
      const dialog = await openThemePicker(hostPage);
      await dialog.locator('.theme-picker-option', { hasText: 'Bộ bài số 2 (Cổ điển)' }).click();
      await dialog.locator('.theme-picker-option', { hasText: 'Bàn Hồng Pastel' }).click();
      await closeThemePicker(hostPage);

      // Verify vector mode renders .card__name-strip instead of .card__art-img
      await expect(hostPage.locator('.hand-container .card img.card__art-img')).toHaveCount(0);
      await expect(hostPage.locator('.hand-container .card .card__name-strip')).toHaveCount(cardCount);

      // Verify [data-table-theme="pastel-pink"] is applied on .game-screen and .seat-ring
      await expect(hostPage.locator('.game-screen')).toHaveAttribute('data-table-theme', 'pastel-pink');
      await expect(hostPage.locator('.seat-ring')).toHaveAttribute('data-table-theme', 'pastel-pink');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
