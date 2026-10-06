# Contact Sheet: photo swipe proof of concept

A swipe app for photos ("Tinder for photos") that runs inside a SharePoint page. People swipe right to keep, left to pass, or up for a hero shot. Every swipe is saved to a SharePoint list, and the Results tab ranks the photos across all reviewers.

`contact-sheet.html` is the whole thing in one file (about 420 KB, with the 10 test photos embedded). Paste it into the custom-script / script-editor web part.

## What it does

| Where it runs | What happens |
| --- | --- |
| Anywhere that isn't SharePoint (a local file, the preview link) | **Demo mode**. No sign-in, swipes are stored in the browser, and 4 example reviewers fill the results. |
| SharePoint page, your account is on the allowed list | Signed in as you (green dot). Swipes are saved to the `PhotoSwipes` list. |
| SharePoint page, account not on the list | "This roll is private" screen showing the exact address SharePoint reports. |
| SharePoint, but the script can't reach `/_api` | Error screen. Usually the module runs the script in a sandboxed iframe. |

## Testing the sign-in

1. Paste `contact-sheet.html` into the script web part on a page **on a site where you have edit rights**.
2. The top-right chip should show your name with a green dot. Open **Connection details** at the bottom: it lists the email, UPN and login name SharePoint returned, and whether access was granted.
3. If you get the locked screen, copy the address it shows into `allowedEmails` at the top of the script (search for `CONFIG`). The check passes if the Email, UPN or login name matches, and it ignores case.
4. To test the lock, use **Preview the locked screen** in Connection details, or remove your address and reload.
5. Click **Create the list** in the banner. This creates `PhotoSwipes` with the `Verdict` and `DwellMs` columns. Swipe a few photos and open the list (Site contents → PhotoSwipes). Each row records who, when, which photo, the verdict, and how many milliseconds they looked.

The allowed list only controls the app's UI: anyone can read the page source. The real protection comes from SharePoint permissions on the page and the `PhotoSwipes` list. Before a wider rollout, restrict the list to the reviewers and turn on *Advanced settings → Item-level permissions → Read items that were created by the user* if reviewers shouldn't see each other's votes. With that setting, the Results tab only shows each person their own votes, so the ranking would need to move to an owner-only view or Power BI.

## Changing the photos

Drop portrait JPEGs (3:4, about 420×560, under ~40 KB) in `src/photos/`, list them in `src/photos.json`, and run:

```
python3 build.py
```

For the real dataset, don't embed the images. Set `src` to URLs in a SharePoint document library instead.

## Files

- `contact-sheet.html`: built, paste-ready file
- `src/app.html`: the app (markup, styles, script; settings at the top of the script)
- `src/photos.json`, `src/photos/`: test photos (public-domain / sample images bundled with scikit-image, scikit-learn and matplotlib)
- `build.py`: embeds the photos into the app
