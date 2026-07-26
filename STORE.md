# Chrome Web Store submission

Everything the listing form asks for, written out. Copy from here into the
dashboard rather than composing in the browser.

---

## Listing

**Name** — `Marlowe`

> Search the store for "Marlowe" before you submit. The store does not enforce
> uniqueness, and a trademark complaint after launch means renaming with your
> reviews attached to the dead name. A personal name used for a cat character
> is low risk, but there is a Marlowe in fintech and one in music software, so
> confirm neither has an extension. If one does, `Marlowe Writes` keeps the
> brand and clears the collision.

**Category** — Fun. Not Productivity: it does not make you write more, it makes
writing nicer, and reviewers read the category as a claim.

**Language** — English

**Short description** (132 char max)

```
A cat sits on your pages and writes a novel out of your typing. It counts keystrokes only, never what you type.
```

**Detailed description**

```
A small cat sits in the corner of every page you visit. When you type, he types.
When you stop, he looks up. When you have been gone a while, he falls asleep.

Everything you write anywhere in your browser becomes words in a novel he is
writing. Six hundred words finishes a chapter. Ten chapters finishes a book, and
the book goes on the shelf in his study with a spine as thick as the words you
put into it. Then he starts another one, and the post begins to arrive: readers
who missed their tram, reviewers who found it damp in places, publishers who
regret that it is not right for their list at this time.

His study is a room, not a dashboard. A lamp, a shelf of everything he has
finished, the letters, and a book of days. You can move him anywhere on the
page, hide him on any site, or turn him off entirely from the toolbar.

What he does not do
He counts that you typed. He never sees what.

Marlowe reads no text. For every key press it adds one to a counter and
throws the key away, inside the event handler, before anything else happens. It
never touches page contents, form fields, URLs, or page titles, and it does not
count anything typed in a password field. There is no server, no account, no
analytics, and no network request of any kind. Everything he knows is a small
number stored on your own computer.

Everything above is free. Rooms are the only thing that will ever be sold, and
the writing itself will never be one of them.

Your record is yours. The Study saves everything to a file you keep, and
restores from one, because nothing syncs and uninstalling deletes it.
```

---

## Privacy tab

**Single purpose**

```
Marlowe displays an animated cat on web pages and advances a fictional
writing progress counter based on how many keys the user presses.
```

**Permission justifications**

- `storage`

```
Stores the keystroke count, the fictional book's progress, and the user's
settings (cat position, hidden sites, movement preference, on/off) locally in
chrome.storage.local. No data leaves the device.
```

- `activeTab`

```
When the user clicks the toolbar icon, the popup reads the active tab's hostname
so it can offer "hide him on this site". The hostname is compared against the
user's hidden-sites list and is only stored if the user turns that option on.
```

- Host access (content script on `<all_urls>`)


```
The cat is rendered as an overlay on the page the user is looking at, and the
keystroke counter must run in the frame that has keyboard focus, so the content
script has to run on any site the user types on. It reads only the fact that a
keydown event occurred; the key itself is discarded inside the handler. Page
content, form values, URLs and titles are never read, stored or transmitted.
```

**Remote code** — No. All code and assets ship inside the package. No `eval`,
no remotely hosted scripts, no CDN.

**Data usage** — tick nothing. Then certify all three:

- not being sold to third parties
- not being used for purposes unrelated to the item's single purpose
- not being used to determine creditworthiness or for lending

**Privacy policy URL** — the page is built and committed at `docs/index.html`.
To publish it:

1. `gh repo create marlowe --public --source . --push` (or push to a repo you
   already made).
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder
   **/docs**.
3. The URL is `https://<user>.github.io/marlowe/`. Paste it into the listing.

`docs/.nojekyll` is there so Pages serves the file as-is instead of running it
through Jekyll.

---

## Graphic assets

| Asset | Size | Required | Status |
|---|---|---|---|
| Store icon | 128×128 PNG | yes | done, `public/icon/128.png` |
| Screenshots | 1280×800, 1 to 5 | yes, at least 1 | done, `store/1-4*.png` |
| Small promo tile | 440×280 PNG | no, but drives discovery | done, `store/promo-440x280.png` |
| Marquee tile | 1400×560 PNG | no, featured placement only | skip for v1 |

Upload the four in `store/` in filename order; the first is the only one most
people look at. They are cropped from real captures by `assets/storeshots.py`,
which holds the crop boxes, so re-running it after a UI change reproduces them.
Put fresh captures in `assets/raw/` under the same filenames.

Worth reshooting before submitting: the Study captures are from a nearly empty
profile, so the shelf is bare and the post is empty. Write for a week, or seed
storage, and shot 2 gains a shelf of books and a sealed letter — which is the
whole pitch.

---

## Pre-submit checks

- [ ] **Load the packed zip unpacked and confirm the cat still appears.**
      `host_permissions` was removed on the reasoning that statically declared
      content scripts inject from their own `matches`. If that is wrong the cat
      vanishes everywhere, so this is the one check that must not be skipped.
- [ ] Toolbar popup opens, all four controls change behaviour on a live page
- [ ] Hide-on-this-site actually hides him, and unhiding brings him back
- [ ] Off switch stops both the sprite and the counting
- [ ] Fresh profile install opens the Study once, and only once
- [ ] Type in Google Docs and confirm the count moves
- [ ] Type in a password field and confirm it does not
- [ ] Two tabs typing at once, confirm no keystrokes are lost
- [ ] Export a backup, uninstall, reinstall, restore — confirm the record returns
- [ ] Version bumped to `1.0.0` in `package.json`
- [ ] `npm run zip` and check the artifact is under the 10 MB store limit

---

## After the button

Review for a first submission with broad host access is usually a few days and
can be a few weeks. Broad host access plus a keyboard listener is exactly the
shape reviewers look at hardest, so the single-purpose statement and the
keystroke justification above are doing real work. Do not ship an update during
review; it replaces the item in the queue and restarts the clock.
