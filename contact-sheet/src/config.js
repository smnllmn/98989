  /* ===== Settings: the only part you normally edit ===== */
  var CONFIG = {
    title: 'Contact Sheet',

    // Who can open the app. Not case-sensitive. If someone gets the locked screen,
    // it shows the exact address SharePoint reports for them: add that one.
    allowedEmails: [
      'simon.sl.laleman@belfius.be',
      'tijs.verthe@belfius.be'
    ],

    // Who also gets the Manage tab (add photos, edit captions, remove photos).
    adminEmails: [
      'simon.sl.laleman@belfius.be'
    ],

    // Document library that holds the photos, and the list that collects the swipes.
    // The app creates both on first use (needs site owner rights), or create them by hand.
    photoLibrary: 'SwipePhotos',
    votesList: 'PhotoSwipes',

    // Leave empty to use the site this page is on, or set another site in the same tenant,
    // e.g. 'https://belfius.sharepoint.com/sites/photo-poc'
    siteUrl: '',

    // 'auto' follows the SharePoint language (Dutch, French or English). Or force 'nl', 'fr' or 'en'.
    language: 'auto',

    // Words on the buttons, per language. The list always stores keep / pass / hero,
    // so renaming these later doesn't split the data.
    labels: {
      nl: { keep: 'Top', pass: 'Flop', hero: 'Unstoppable' },
      fr: { keep: 'Top', pass: 'Flop', hero: 'Unstoppable' },
      en: { keep: 'Keep', pass: 'Pass', hero: 'Unstoppable' }
    },

    // Card shape: 'auto' (portrait on phones, landscape on wide screens), 'portrait', 'landscape' or 'square'.
    cardShape: 'auto',

    // Photos added through the Manage tab are resized to this many pixels on the long edge.
    maxPhotoEdge: 1600,

    // How often the Results tab checks SharePoint for new swipes, in seconds. 0 turns it off.
    liveSeconds: 10
  };
  /* ===================================================== */
