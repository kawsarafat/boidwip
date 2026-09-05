import { expect, test, type Page } from "@playwright/test";

/** The mobile navigation drawer: the audit's mobile UX and accessibility items,
 *  plus the "mobile menu keyboard/focus behaviour" essential test.
 *
 *  WHY THIS FILE IS `.mobile.spec.ts`. The drawer and its trigger are `lg:hidden`
 *  — on a desktop viewport the trigger is not rendered at all, so these specs
 *  are only meaningful on a phone. playwright.config.ts routes files named
 *  `*.mobile.spec.ts` to the Pixel 7 project and only that project.
 *
 *  WHY THE ASSERTIONS ARE ABOUT FOCUS AND GEOMETRY rather than screenshots. The
 *  panel carries `aria-modal="true"`, which is a promise that the rest of the
 *  document is unavailable; a keyboard or screen-reader user only actually gets
 *  that if focus moves in, stays in, and comes back to the trigger on close.
 *  None of that is visible in a picture, and all of it broke silently the last
 *  time this component was refactored (it rendered in place and came out 56px
 *  tall inside the blurred header — see the note in components/MobileMenu.tsx).
 *
 *  Selectors are the component's own contract — `aria-controls`, the panel id,
 *  and the very focusable-node selector the trap itself queries — so a rename
 *  that breaks the trap breaks these tests too, which is the point. */

const TRIGGER = 'button[aria-controls="mobile-nav"]';
const PANEL = "#mobile-nav";

/** Copied verbatim from the focus trap in components/MobileMenu.tsx, so the test
 *  walks exactly the set the trap walks rather than a lookalike. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusIsInPanel = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const panel = document.getElementById("mobile-nav");
    const active = document.activeElement;
    return Boolean(panel && active && panel.contains(active));
  });

const openDrawer = async (page: Page): Promise<void> => {
  await page.locator(TRIGGER).click();
  await expect(page.locator(PANEL)).toBeVisible();
  await expect(page.locator(TRIGGER)).toHaveAttribute("aria-expanded", "true");
};

test.describe("mobile navigation drawer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens as a modal dialog and moves focus inside", async ({ page }) => {
    const trigger = page.locator(TRIGGER);
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await openDrawer(page);
    const panel = page.locator(PANEL);
    await expect(panel).toHaveAttribute("role", "dialog");
    await expect(panel).toHaveAttribute("aria-modal", "true");

    // Focus lands on the search field (autoFocus), but the invariant is only
    // that it is somewhere inside the dialog — asserting the exact element
    // would break the day the panel's first control changes.
    await expect
      .poll(() => focusIsInPanel(page), { message: "focus did not move into the drawer" })
      .toBe(true);

    // Body scroll is locked while open, so the swipe scrolls the panel and not
    // the page behind the scrim.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  });

  test("traps Tab and Shift+Tab inside the panel", async ({ page }) => {
    await openDrawer(page);

    // Forward from the last focusable node must wrap to the first, not walk
    // into the page behind the scrim.
    await page.evaluate((selector) => {
      const nodes = document.getElementById("mobile-nav")?.querySelectorAll<HTMLElement>(selector);
      nodes?.[nodes.length - 1]?.focus();
    }, FOCUSABLE);
    await page.keyboard.press("Tab");
    expect(await focusIsInPanel(page), "Tab escaped the drawer").toBe(true);

    // …and backward from the first.
    await page.evaluate((selector) => {
      document.getElementById("mobile-nav")?.querySelector<HTMLElement>(selector)?.focus();
    }, FOCUSABLE);
    await page.keyboard.press("Shift+Tab");
    expect(await focusIsInPanel(page), "Shift+Tab escaped the drawer").toBe(true);
  });

  test("Escape closes it and returns focus to the trigger", async ({ page }) => {
    await openDrawer(page);
    await page.keyboard.press("Escape");

    // The panel stays mounted for the length of the exit animation, so this
    // waits for the unmount rather than asserting on the next tick.
    await expect(page.locator(PANEL)).toHaveCount(0);
    await expect(page.locator(TRIGGER)).toHaveAttribute("aria-expanded", "false");
    // Without this the next Tab starts from the top of the document.
    await expect(page.locator(TRIGGER)).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});

test.describe("closing by pointer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("the close button and the scrim both dismiss the drawer", async ({ page }) => {
    await openDrawer(page);
    // The first <button> inside the panel is the close control: the only thing
    // before it in the header row is the logo, which is a link.
    await page.locator(`${PANEL} button`).first().click();
    await expect(page.locator(PANEL)).toHaveCount(0);

    await openDrawer(page);
    // The scrim is the panel's preceding sibling — a real button rather than a
    // div with a click handler, so it is keyboard-reachable too. It spans the
    // viewport and the panel sits on top of its right-hand 88%, so the click
    // has to land in the exposed strip rather than the element's centre.
    const scrim = page.locator('xpath=//div[@id="mobile-nav"]/preceding-sibling::button');
    await scrim.click({ position: { x: 5, y: 5 } });
    await expect(page.locator(PANEL)).toHaveCount(0);
    await expect(page.locator(TRIGGER)).toBeFocused();
  });

  test("every tap target clears 44x44", async ({ page }) => {
    // The trigger is the only route to navigation on a phone and it sits in the
    // corner, where thumb accuracy is worst. Both platform guidelines ask for
    // 44; WCAG 2.5.8 asks for 24 as a floor.
    const triggerBox = await page.locator(TRIGGER).boundingBox();
    expect(triggerBox?.width ?? 0, "menu trigger width").toBeGreaterThanOrEqual(44);
    expect(triggerBox?.height ?? 0, "menu trigger height").toBeGreaterThanOrEqual(44);

    await openDrawer(page);

    const closeBox = await page.locator(`${PANEL} button`).first().boundingBox();
    expect(closeBox?.width ?? 0, "drawer close width").toBeGreaterThanOrEqual(44);
    expect(closeBox?.height ?? 0, "drawer close height").toBeGreaterThanOrEqual(44);

    // Rows are full-width, so only their height is in question. Browse and info
    // links are static, which is why this needs no seeded content to be real.
    const links = page.locator(`${PANEL} ul a`);
    const count = await links.count();
    expect(count, "the drawer should list browse and info links").toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box?.height ?? 0, `drawer row ${i} height`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("with prefers-reduced-motion", () => {
  // Through contextOptions, not a top-level `reducedMotion` key: Playwright 1.62
  // moved the standalone emulation options under the context options bag, and
  // the old spelling is not in the types any more.
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the panel rests on screen instead of parked off it", async ({ page }) => {
    // globals.css collapses every animation to 0.01ms under reduced motion, so
    // this is the one configuration where the slide contributes nothing and the
    // panel's resting position is all there is. The keyframe approach was chosen
    // precisely so that state is ON screen — an implementation that animated
    // from a translated class would leave the drawer invisible here, and a
    // reader who asked for less motion would simply have no navigation.
    await page.goto("/");
    await openDrawer(page);

    const box = await page.locator(PANEL).boundingBox();
    const viewport = page.viewportSize();
    expect(box, "the drawer has no box").not.toBeNull();
    expect(viewport, "no viewport size on a device project").not.toBeNull();
    if (!box || !viewport) return;

    expect(box.width, "the drawer collapsed to nothing").toBeGreaterThan(100);
    expect(box.height, "the drawer is not full height").toBeGreaterThan(300);
    expect(box.x, "the drawer starts off the left edge").toBeGreaterThanOrEqual(0);
    // One pixel of slack for sub-pixel layout on a fractional device width.
    expect(box.x + box.width, "the drawer hangs off the right edge").toBeLessThanOrEqual(
      viewport.width + 1,
    );
  });
});
