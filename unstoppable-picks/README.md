# Unstoppable Picks: a photo swipe app for SharePoint

People swipe through photos: right for **Top**, left for **Flop**, up for **Unstoppable**. The photos live in a SharePoint document library, and every swipe is saved to a SharePoint list. Only admins see the results: a live, anonymous ranking they reveal, for example full-screen with Present. The look follows the Belfius app: raspberry stage, glass tiles, white sheets, Montserrat. It speaks Dutch, French and English.

| File | Use it for |
| --- | --- |
| `unstoppable-picks.html` | **Paste this into the custom-script module.** The app and its font, about 200 KB, no photos inside. |
| `unstoppable-picks-demo.html` | Opening on a laptop without SharePoint. It has 10 sample photos and 4 example reviewers. |

The name is a setting: `title` at the top of the script. It can be one name, or one per language (`{ nl: '…', fr: '…', en: '…' }`).

## Setup (about 5 minutes)

1. **Pick the site.** Use a site where the custom-script module runs JavaScript (the one v1 worked on). The intranet-news site reports custom script as *off*. Make both admins **site owners** on that site.
2. **Paste** `unstoppable-picks.html` into the custom-script module on a page and publish it.
3. **Open the page as an admin.** You get *Set up this site*. Click **Set up now**. This creates:
   - `SwipePhotos`: a document library for the photos.
   - `PhotoSwipes`: a list for the votes, with the columns `Verdict`, `DwellMs` and `PhotoName`. It is locked so that people can only read their own rows.
4. **Add photos** in the **Manage** tab. Drag them in, or click to choose files.
   - Big photos are resized to 1600 px before upload, so they load fast. Web-ready JPEGs go up unchanged.
   - Each photo gets a caption from its file name. Click a caption to edit it.
   - You can also drop photos straight into the `SwipePhotos` library in SharePoint. Folders show up as a label on the card. JPEGs over 1.5 MB get a **Shrink** button that resizes them in place (same item, votes stay attached). With version history on, the original stays in the history.
5. **Give reviewers access.** They need **Read** on the page and on `SwipePhotos`, and **Contribute** on `PhotoSwipes`. The site's Members group gives them both.
6. **Share the page link.** For the C-level session, open **Results** on an admin's screen and click **Present** for a full-screen live leaderboard.

### Creating the library and list by hand

Use this if you can't use **Set up now**:

- **Site contents → New → Document library**, named `SwipePhotos`.
- **Site contents → New → List → Blank list**, named `PhotoSwipes`, with these columns. Use exactly these names, without spaces:
  - `Verdict`: single line of text
  - `DwellMs`: number
  - `PhotoName`: single line of text
- On `PhotoSwipes`, go to **Settings → Advanced settings → Item-level permissions** and set:
  - Read access: *Read items that were created by the user*
  - Create and Edit access: *Create items and edit items that were created by the user*

## Results are for admins only

Players never see results. They have no Results tab, no Present, and no "see the results" button. When they finish, they get a thank-you saying the organisers will reveal the results. There is no setting that changes this.

- **Players' browsers** only ever load their own votes. Nothing else about the results reaches them.
- **Admins** see the live ranking, without names, and can show it full-screen with **Present**.
- **The votes list** is locked: people can only read their own rows, even when they open the list in SharePoint. Only site owners see every row, which is why admins must be site owners.
  - If the list isn't locked yet (an older list, or one made by hand), the Manage tab shows a warning with a **Lock it down** button.
  - If an admin isn't a site owner, the Manage tab says the results are incomplete.
  - **⋮ → Connection details** shows the privacy state.
  - `anonymous: false` only leaves the votes list unlocked. Players still never see results.

## Who can do what

- **`allowedEmails`** are the players: they can open the app and swipe.
- **`adminEmails`** also get Results, Present and Manage. Simon and Tijs are admins. Admins don't need to be on the allowed list as well.
- Everyone else gets *This photo round is private*, which shows the exact address to add.

The lists are at the top of the script (search for `CONFIG`). Matching is not case-sensitive and uses the email, UPN and login name.

These lists only control what the app shows. The real protection is SharePoint permissions on the page, the library and the list.

**Checking what others see.** In the ⋮ menu, admins have:

- **View as reviewer**: exactly what players see. No tabs, no results, only your own votes. A banner takes you back.
- **Preview the locked screen**: what colleagues outside the list see.

## What gets saved

Each swipe is one row in `PhotoSwipes`:

| Column | Contents |
| --- | --- |
| Title | ID of the photo in the library |
| Verdict | `keep`, `pass` or `hero`. The words on screen are configurable; the stored codes don't change. |
| DwellMs | How long the person looked before deciding, in milliseconds |
| PhotoName | The photo's file name |
| Created By, Created | Who swiped and when (visible to site owners only) |

If someone swipes the same photo twice, their latest vote counts. Undo removes the saved row (it goes to the recycle bin).

Swipes that couldn't be saved yet are kept in the browser and sent the next time the page opens. If the page is closed while saving, the browser asks the person to confirm.

**Export** on the Results tab downloads the ranking as CSV. It uses semicolons and UTF-8, so it opens in Excel with Belgian settings.

## Results

- **Score**: the share of reviewers who chose Top or Unstoppable.
- **Ties** are broken by the number of Unstoppable votes, then by the number of votes.
- **Podium**: the top 3 photos.
- **Highlights**: the photo picked most often as Unstoppable, the most divided photo (close to 50/50), and *your taste*: how often you agree with the rest of the group.

## Settings

All settings are at the top of the script, in `CONFIG`:

| Setting | Default |
| --- | --- |
| `title` | `Unstoppable Picks`, or one name per language |
| `allowedEmails`, `adminEmails` | See *Who can do what* |
| `anonymous` | `true`: lock the votes list so people only read their own rows |
| `photoLibrary`, `votesList` | `SwipePhotos`, `PhotoSwipes` |
| `siteUrl` | Empty, meaning this site. Set it to keep the data on another site in the same tenant. |
| `language` | `auto`, which follows each person's SharePoint language. Or `nl`, `fr`, `en`. People can also switch in the ⋮ menu. |
| `labels` | Top / Flop / Unstoppable in NL and FR; Keep / Pass / Unstoppable in EN |
| `cardShape` | `auto`: portrait on phones, landscape on wide screens |
| `maxPhotoEdge` | `1600` |
| `liveSeconds` | `10` |

## Editing the app

The source is split into parts under `src/`. Edit those, then rebuild both HTML files:

```
python3 build.py
```

| Path | What it holds |
| --- | --- |
| `src/config.js` | The settings block |
| `src/i18n-*.js` | Texts in Dutch, French and English |
| `src/app-*.js` | The app: SharePoint calls, swiping, results, the Manage tab, screens, start-up |
| `src/styles*.css` | Styles |
| `src/markup.html` | Markup |
| `src/fonts/` | Montserrat (SIL Open Font License, see `Montserrat-OFL.txt`) |
| `src/photos/`, `src/photos.json` | Demo photos only: public-domain and sample images from scikit-image, scikit-learn and matplotlib |
