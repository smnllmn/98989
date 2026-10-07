  /* ===== Settings: the only part you normally edit ===== */
  var CONFIG = {
    // App name. One name for every language, or one per language: { nl: '…', fr: '…', en: '…' }
    title: 'Unstoppable Photos',

    // Who can open the app. Not case-sensitive. If someone gets the locked screen,
    // it shows the exact address SharePoint reports for them: add that one.
    allowedEmails: [
      'simon.sl.laleman@belfius.be',
      'tijs.verthe@belfius.be'
    ],

    // Who also gets the Manage tab (add photos, edit captions, remove photos).
    // Make them site owners too: only owners can see everyone's votes once the list is locked down.
    // Admins can check what reviewers see under the ⋮ menu: "View as reviewer".
    adminEmails: [
      'simon.sl.laleman@belfius.be',
      'tijs.verthe@belfius.be'
    ],

    // Results are only ever shown to admins; players never see them. Players' browsers only load their
    // own votes. With anonymous on, setup also locks the votes list so that in SharePoint people can
    // only read their own rows (site owners still see everything). false leaves the list open.
    anonymous: true,

    // Document library that holds the photos, and the list that collects the swipes.
    // The app creates both on first use (needs site owner rights), or create them by hand.
    photoLibrary: 'SwipePhotos',
    votesList: 'PhotoSwipes',

    // Leave empty to use the site this page is on, or set another site in the same tenant,
    // e.g. 'https://belfius.sharepoint.com/sites/photo-poc'
    siteUrl: 'https://belfius.sharepoint.com/teams/23032314150408',

    // 'auto' follows the SharePoint language (Dutch, French or English). Or force 'nl', 'fr' or 'en'.
    language: 'auto',

    // Words on the buttons, per language. The list always stores keep / pass / hero,
    // so renaming these later doesn't split the data.
    labels: {
      nl: { keep: 'Top', pass: 'Flop', hero: 'Unstoppable' },
      fr: { keep: 'Top', pass: 'Flop', hero: 'Unstoppable' },
      en: { keep: 'Keep', pass: 'Pass', hero: 'Unstoppable' }
    },

    // Photo categories (brands). Admins set them in Manage; players swipe one after the other, in this order.
    // id is what each photo carries in the library: keep it when you rename a brand. Photos without a category
    // count as the first one. logo: 'belfius', 'belfius-private' or 'rebel' (built into the file); without a
    // logo the name is shown. theme 'rebel' shows that category in ReBel's look.
    categories: [
      { id: 'belfius', name: 'Belfius Private', logo: 'belfius-private' },
      { id: 'rebel', name: 'ReBel', theme: 'rebel', logo: 'rebel' }
    ],

    // Card shape: 'auto' (portrait on phones, landscape on wide screens), 'portrait', 'landscape' or 'square'.
    cardShape: 'auto',

    // Photos added through the Manage tab are resized to this many pixels on the long edge.
    maxPhotoEdge: 1600,

    // How often the Results tab checks SharePoint for new swipes, in seconds. 0 turns it off.
    liveSeconds: 10
  };
  /* ===================================================== */
