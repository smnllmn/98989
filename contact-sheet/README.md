# Contact Sheet: photo swipe app for SharePoint

People swipe through photos: right for **Top**, left for **Flop**, up for **Unstoppable**. The photos live in a SharePoint document library. Every swipe is saved to a SharePoint list, and the Results tab ranks the photos live across everyone. It looks like the Belfius app: raspberry stage, glass tiles, white sheets, Montserrat. It speaks Dutch, French and English.

| File | Use it for |
| --- | --- |
| `contact-sheet.html` | **Paste this into the custom-script module.** App plus font, about 190 KB, no photos inside. |
| `contact-sheet-demo.html` | Opening on a laptop without SharePoint. It has 10 sample photos and 4 example reviewers. |

## Setup (about 5 minutes)

1. **Pick the site.** Use a site where the custom-script module runs JavaScript (the one v1 worked on). The intranet-news site reports custom script as *off*. You need owner rights on the site for step 3, or create the library and list by hand (see below).
2. **Paste** `contact-sheet.html` into the custom-script module on a page and publish it.
3. **Open the page as an admin** (`adminEmails`). You get *Set up this site*. Click **Set up now**. This creates:
   - `SwipePhotos`: a document library for the photos.
   - `PhotoSwipes`: a list for the votes, with the columns `Verdict`, `DwellMs` and `PhotoName`.
4. **Add photos** in the **Manage** tab. Drag them in, or click to choose files.
   - Big photos are resized to 1600 px before upload, so they load fast. Web-ready JPEGs go up unchanged.
   - Each photo gets a caption from its file name. Click a caption to edit it.
   - You can also drop photos straight into the `SwipePhotos` library in SharePoint. Folders show up as a label on the card. JPEGs over 1.5 MB get a **Shrink** button that resizes them in place (same item, votes stay attached). With version history on, the original stays in the history.
5. **Give reviewers access.** They need **Read** on the page and on `SwipePhotos`, and **Contribute** on `PhotoSwipes` so they can add swipes and undo them. The simplest route for a PoC is the site's Members group.
6. **Share the page link.** For the C-level session, open **Results** and click **Present** for a full-screen live leaderboard. It updates every 10 seconds as people swipe.

### Creating the library and list by hand

Use this if you aren't a site owner:

- **Site contents → New → Document library**, named `SwipePhotos`.
- **Site contents → New → List → Blank list**, named `PhotoSwipes`, with these columns. Use exactly these names, without spaces:
  - `Verdict`: single line of text
  - `DwellMs`: number
  - `PhotoName`: single line of text

## Who can do what

- **`allowedEmails`** can open the app, swipe and see results. Currently Simon and Tijs.
- **`adminEmails`** also get the Manage tab. Currently Simon; add Tijs on that line if he should manage photos.
- Everyone else gets *This photo round is private*, which shows the exact address to add.

The lists are at the top of the script (search for `CONFIG`). Matching is not case-sensitive, and the check uses the email, UPN and login name.

These lists only control what the app shows. Anyone can read the page source. The real protection is SharePoint permissions on the page, the library and the list.

If reviewers must not see each other's votes, set *PhotoSwipes → Advanced settings → Item-level permissions → Read items that were created by the user*. The Results tab then shows each person only their own votes, so keep the ranking for owners (or Power BI).

## What gets saved

Each swipe is one row in `PhotoSwipes`:

| Column | Contents |
| --- | --- |
| Title | ID of the photo in the library |
| Verdict | `keep`, `pass` or `hero`. The words on screen are configurable; the stored codes don't change. |
| DwellMs | How long the person looked before deciding, in milliseconds |
| PhotoName | The photo's file name |
| Created By, Created | Who swiped, and when |

If someone swipes the same photo twice, their latest vote counts. Undo removes the saved row (it goes to the recycle bin).

Swipes that couldn't be saved yet are kept in the browser and sent the next time the page opens. If the page is closed while saving, the browser asks the person to confirm.

**Export** on the Results tab downloads the ranking as CSV. It uses semicolons and UTF-8, so it opens in Excel with Belgian settings. You can also export the `PhotoSwipes` list to Excel from SharePoint.

## Results

- **Score**: the share of reviewers who chose Top or Unstoppable.
- **Ties** are broken by the number of Unstoppable votes, then by the number of votes.
- **Podium**: the top 3 photos.
- **Highlights**: the photo picked most often as Unstoppable, the most divided photo (close to 50/50), and *your taste*: how often you agree with the rest of the group.

## Settings

All settings are at the top of the script, in `CONFIG`:

| Setting | Default |
| --- | --- |
| `title` | `Contact Sheet` |
| `allowedEmails`, `adminEmails` | See *Who can do what* |
| `photoLibrary`, `votesList` | `SwipePhotos`, `PhotoSwipes` |
| `siteUrl` | Empty, meaning this site. Set it to keep the data on another site in the same tenant. |
| `language` | `auto`, which follows the SharePoint language. Or `nl`, `fr`, `en`. People can also switch in the ⋮ menu. |
| `labels` | Top / Flop / Unstoppable in NL and FR; Keep / Pass / Unstoppable in EN |
| `cardShape` | `auto`: portrait on phones, landscape on wide screens |
| `maxPhotoEdge` | `1600` |
| `liveSeconds` | `10` |

## Testing the sign-in

- **⋮ → Connection details** shows the email, UPN and login SharePoint returned, the role, and the state of the library and the list.
- **Preview the locked screen** shows what colleagues outside the list see.

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
