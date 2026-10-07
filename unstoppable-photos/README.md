# Unstoppable Photos: a photo swipe app for SharePoint

People swipe through photos: right for **Top**, left for **Flop**, up for **Unstoppable**. The photos live in a SharePoint document library, and every swipe is saved to a SharePoint list. Only admins see the results: a live, anonymous ranking they reveal, for example full-screen with Present. The look follows the Belfius app: raspberry stage, glass tiles, white sheets, Montserrat. It speaks Dutch, French and English.

| File | Use it for |
| --- | --- |
| `unstoppable-photos.js` | **Upload this** to *SiteAssets › SitePages › UnstoppablePhotos* on intranet-company. The whole app in one file (about 280 KB, no photos). |
| `unstoppable-photos-loader.html` | **Paste this into the Involv Script Editor** on the page. A short loader that fetches the file above. |
| `unstoppable-photos.html` | The same app as one paste-in block. It runs while you edit the page, but it is too big to survive saving in the Involv Script Editor, so the published page stays empty. Use the loader instead. |
| `unstoppable-photos-demo.html` | Opening on a laptop without SharePoint. It has 10 sample photos and 4 example reviewers. |

The name is a setting: `title` at the top of the script. It can be one name, or one per language (`{ nl: '…', fr: '…', en: '…' }`).

## Setup (about 5 minutes)

1. **Pick the sites.**
   - **The page** goes on a site where the custom-script module runs JavaScript, such as intranet-company. The intranet-news site reports custom script as *off*.
   - **The data** (photos and votes) goes on the site in `siteUrl`, currently the Content Team Internal Com team site. Admins must see every vote: make them **owners** of that site, or, without adding them to the team, give them *Full Control* on just the `PhotoSwipes` list (plus *Read* on `SwipePhotos`, or *Edit* if they should manage photos).
   - Players without access to the data site see *Nog geen toegang* with their address, so you know whom to add.
2. **Put the app on the page.**
   - Upload `unstoppable-photos.js` to *SiteAssets › SitePages › UnstoppablePhotos* on intranet-company. Everyone who can open the page can read that folder. If the library asks you to check the file in or publish it, do so.
   - Paste `unstoppable-photos-loader.html` into the Involv Script Editor on the page and publish. If you put the file somewhere else, change the address in the loader (`SCRIPT_URL` in `build.py`).
   - **Updating the app later:** upload the new `unstoppable-photos.js` over the old one. The page doesn't change, and the loader always fetches the latest file.
3. **Open the page as an admin.** You get *Set up this site*. Click **Set up now**. This creates:
   - `SwipePhotos`: a document library for the photos.
   - `PhotoSwipes`: a list for the votes, with the columns `Verdict`, `DwellMs` and `PhotoName`. It is locked so that people can only read their own rows.
4. **Add photos** in the **Manage** tab. Drag them in, or click to choose files.
   - Big photos are resized to 1600 px before upload, so they load fast. Web-ready JPEGs go up unchanged.
   - Each photo gets a caption from its file name. Click a caption to edit it.
   - You can also drop photos straight into the `SwipePhotos` library in SharePoint. Folders show up as a label on the card. JPEGs over 1.5 MB get a **Shrink** button that resizes them in place (same item, votes stay attached). With version history on, the original stays in the history.
5. **Give players access** on the data site: **Read** on `SwipePhotos` and **Contribute** on `PhotoSwipes`. Either add them to the team, or give them rights on just those two without making them members: in the library's and the list's settings, open *Permissions for this list/library*, click *Stop inheriting permissions* (once), then *Grant permissions*, and pick the level under *Show options*. A SharePoint group for the players saves adding everyone twice. They also need to be able to open the page.
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

Players never see results. They have no Results tab, no Present, and no "see the results" button. When they finish, they get a thank-you with their own count of Tops, and nothing about results. There is no setting that changes this.

- **Players' browsers** only ever load their own votes. Nothing else about the results reaches them.
- **Admins** see the live ranking, without names, and can show it full-screen with **Present**.
- **The votes list** is locked: people can only read their own rows, even when they open the list in SharePoint. Only site owners see every row, which is why admins must be site owners.
  - If the list isn't locked yet (an older list, or one made by hand), the Manage tab shows a warning with a **Lock it down** button.
  - If an admin isn't a site owner, the Manage tab says the results are incomplete.
  - **⋮ → Connection details** shows the privacy state.
  - `anonymous: false` only leaves the votes list unlocked. Players still never see results.

## Categories

Photos belong to a category: **Belfius Private** or **ReBel** for this PoC (`categories` in the settings).

- **Manage**: pick the category for new photos above the upload area. Each photo has a **Belfius Private | ReBel** switch, and you can filter the grid by category. The category is stored in a *Category* column of the photo library, which the app creates itself. Photos without a category count as the first one (Belfius Private).
- **Swiping**: players get the photos brand by brand, in the order of the settings: Belfius Private first, then ReBel. The intro says "De foto’s komen per merk." (no counts, so it scales to many brands). The first brand starts right after **Starten**. Every next brand opens with a title card in place of the photo: "Merk 2 van 2", the brand's logo, the number of photos and a **Verder** button. There is no timer: the vote buttons stay off until the player taps Verder (or presses Enter). Undo still works on the title card. The brand's logo stays above the card while its photos are up. While ReBel photos are up, the app switches to ReBel's look (black with a lilac glow, #D5A8FF).
- **Results**: filter by Alle, Belfius Private or ReBel for a podium and ranking per category. The export has a Categorie column.

The logos are the official files in `src/brand/` (`belfius-private-white.png`, `rebel-logo.png`, and `belfius-logo.png` for a plain Belfius brand later). They are embedded in the file at build time; a category picks one with `logo: 'belfius-private'`, `'rebel'` or `'belfius'`. A category without a logo shows its name instead. The white Belfius Private logo sits straight on the Belfius colour above the photo (no box); if it is ever not the first brand, its title card is raspberry with the white logo. The photo stays in the same place when the brand changes.

Each category's `id` is what the photos carry in the library. Change a name or logo freely, but keep the `id`: Belfius Private still has the id `belfius` from when brand 1 was called Belfius, so its photos stayed put. A new brand needs a new id (a plain Belfius brand would be, say, `belfius-bank`). Players see "merk" (brand); Manage and Results say "Categorie".

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
| `title` | `Unstoppable Photos`, or one name per language |
| `allowedEmails`, `adminEmails` | See *Who can do what* |
| `anonymous` | `true`: lock the votes list so people only read their own rows |
| `photoLibrary`, `votesList` | `SwipePhotos`, `PhotoSwipes` |
| `siteUrl` | `https://belfius.sharepoint.com/teams/23032314150408` (the Content Team Internal Com team site). The photos and votes live there; the page itself can be on intranet-company. Empty means the site the page is on. |
| `language` | `auto`, which follows each person's SharePoint language. Or `nl`, `fr`, `en`. People can also switch in the ⋮ menu. |
| `categories` | Belfius Private, then ReBel (with `theme: 'rebel'`), each with its `logo`. Order = swipe order. Keep each `id` when renaming. |
| `labels` | Top / Flop / Unstoppable in NL and FR; Keep / Pass / Unstoppable in EN |
| `cardShape` | `auto`: portrait on phones, landscape on wide screens |
| `maxPhotoEdge` | `1600` |
| `liveSeconds` | `10` |

## Editing the app

The source is split into parts under `src/`. Edit those, then rebuild all four files:

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
