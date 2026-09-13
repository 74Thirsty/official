(function () {
  const nav = document.querySelector('nav[aria-label="Primary navigation"]');
  if (!nav) return;

  const style = document.createElement('style');
  style.textContent = `
    .llr-nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:10px max(18px,5vw);position:sticky;top:0;z-index:1000;background:rgba(5,5,5,.97);border-bottom:1px solid #303030;color:#fff;font-family:Arial,Helvetica,sans-serif}
    .llr-nav *{box-sizing:border-box}.llr-nav a{color:inherit}.llr-nav-brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;font-weight:900;white-space:nowrap}.llr-nav-brand img{width:50px;height:50px;object-fit:contain}
    .llr-nav-toggle{display:none;min-height:44px;padding:9px 14px;border:1px solid #555;border-radius:8px;background:#181818;color:#fff;font:inherit;font-weight:800;cursor:pointer}.llr-nav-links{display:flex;align-items:center;justify-content:flex-end;gap:8px}.llr-nav-direct,.llr-nav-group-button{display:inline-flex;align-items:center;min-height:44px;padding:9px 11px;border:0;background:transparent;color:#fff;text-decoration:none;font:inherit;font-weight:800;cursor:pointer}.llr-nav-direct:hover,.llr-nav-direct:focus-visible,.llr-nav-group-button:hover,.llr-nav-group-button:focus-visible{color:#ff6a00}.llr-nav a:focus-visible,.llr-nav button:focus-visible{outline:3px solid #ff6a00;outline-offset:2px}.llr-nav-group{position:relative}.llr-nav-caret{display:inline-block;margin-left:7px;border:4px solid transparent;border-top-color:currentColor;transform:translateY(3px)}.llr-nav-menu{display:none;position:absolute;top:calc(100% + 4px);left:0;min-width:235px;padding:8px;background:#181818;border:1px solid #303030;border-radius:10px;box-shadow:0 20px 45px rgba(0,0,0,.45)}.llr-nav-group.open .llr-nav-menu{display:grid}.llr-nav-menu a{padding:10px 12px;border-radius:7px;color:#fff;text-decoration:none;font-weight:700}.llr-nav-menu a:hover,.llr-nav-menu a:focus-visible{background:#292929;color:#ff6a00}.llr-nav-group.is-active>.llr-nav-group-button,.llr-nav-direct[aria-current="page"]{color:#ff6a00}
    .llr-paypal-nav{display:none;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:9px 17px;border-radius:24px;background:#ffc439;color:#111820!important;text-decoration:none;font-weight:900;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,.3)}.llr-paypal-nav:hover{background:#f2ba36}.llr-paypal-nav img{width:23px;height:23px;object-fit:contain}
    @media(max-width:1000px){.llr-nav{align-items:center;flex-wrap:wrap}.llr-nav-toggle{display:inline-flex;align-items:center}.llr-nav-links{display:none;flex:1 0 100%;align-items:stretch;flex-direction:column;padding:8px 0 12px}.llr-nav.menu-open .llr-nav-links{display:flex}.llr-nav-direct,.llr-nav-group-button{width:100%;justify-content:space-between;padding:10px 12px}.llr-nav-menu{position:static;min-width:0;margin:0 8px;box-shadow:none}.llr-paypal-nav{width:100%;margin-top:5px}.llr-nav-brand img{width:44px;height:44px}}
  `;
  document.head.appendChild(style);

  nav.className = 'llr-nav';
  nav.innerHTML = `
    <a class="llr-nav-brand" href="index.html" aria-label="Lost Limb Riders home"><img src="assets/logo-nobg.png" alt=""><span>Lost Limb Riders</span></a>
    <button class="llr-nav-toggle" type="button" aria-expanded="false" aria-controls="llrNavLinks">Menu</button>
    <div class="llr-nav-links" id="llrNavLinks">
      <a class="llr-nav-direct" href="index.html">Home</a>
      <div class="llr-nav-group"><button class="llr-nav-group-button" type="button" aria-expanded="false">About <span class="llr-nav-caret" aria-hidden="true"></span></button><div class="llr-nav-menu"><a href="mission.html#story">Our Story</a><a href="mission.html#mission-statement">Our Mission</a><a href="mission.html#vision">Our Vision</a><a href="mission.html#org-info">Organization Info</a></div></div>
      <div class="llr-nav-group"><button class="llr-nav-group-button" type="button" aria-expanded="false">Programs <span class="llr-nav-caret" aria-hidden="true"></span></button><div class="llr-nav-menu"><a href="peer-support.html">Peer Support</a><a href="mission.html#funds">Family Support Initiative</a><a href="healthcare-partnerships.html">Hospital &amp; Prosthetic Outreach</a><a href="mission.html#funds">View All Programs</a></div></div>
      <div class="llr-nav-group"><button class="llr-nav-group-button" type="button" aria-expanded="false">Get Involved <span class="llr-nav-caret" aria-hidden="true"></span></button><div class="llr-nav-menu"><a href="join.html">Become a Member</a><a href="volunteer-employment.html">Volunteer / Employment</a><a href="sponsors.html">Become a Sponsor</a><a href="donate.html">Donate</a></div></div>
      <div class="llr-nav-group"><button class="llr-nav-group-button" type="button" aria-expanded="false">Community <span class="llr-nav-caret" aria-hidden="true"></span></button><div class="llr-nav-menu"><a href="events.html">Events</a><a href="media.html">Media</a><a href="community.html">Gallery</a><a href="community.html">Testimonials</a><a href="documentation.html">Resources</a><a href="compliance.html">Compliance Engine</a></div></div>
      <a class="llr-nav-direct" href="tel:5158905765">Contact</a>
      <a class="llr-paypal-nav" id="llrPaypalNav" aria-label="Donate with PayPal"><img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="">Donate</a>
    </div>`;

  const toggle = nav.querySelector('.llr-nav-toggle');
  toggle.addEventListener('click', function () {
    const open = nav.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('.llr-nav-group-button').forEach(function (button) {
    button.addEventListener('click', function () {
      const group = button.closest('.llr-nav-group');
      const opening = !group.classList.contains('open');
      nav.querySelectorAll('.llr-nav-group.open').forEach(function (item) {
        item.classList.remove('open');
        item.querySelector('.llr-nav-group-button').setAttribute('aria-expanded', 'false');
      });
      group.classList.toggle('open', opening);
      button.setAttribute('aria-expanded', String(opening));
    });
  });

  document.addEventListener('click', function (event) {
    if (!nav.contains(event.target)) nav.querySelectorAll('.llr-nav-group.open').forEach(function (group) {
      group.classList.remove('open');
      group.querySelector('.llr-nav-group-button').setAttribute('aria-expanded', 'false');
    });
  });

  const current = location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('a[href]').forEach(function (link) {
    const path = link.getAttribute('href').split('#')[0];
    if (path === current) {
      if (link.classList.contains('llr-nav-direct')) link.setAttribute('aria-current', 'page');
      const group = link.closest('.llr-nav-group');
      if (group) group.classList.add('is-active');
    }
  });

  const paypal = nav.querySelector('#llrPaypalNav');
  fetch('/api/support?action=paypal-config').then(function (response) {
    if (!response.ok) throw new Error();
    return response.json();
  }).then(function (config) {
    if (!config.configured || !config.donationUrl) throw new Error();
    paypal.href = config.donationUrl;
    paypal.style.display = 'inline-flex';
    document.querySelectorAll('a[href="donate.html"]').forEach(function (link) {
      if (link.textContent.trim() === 'Donate') link.href = config.donationUrl;
    });
  }).catch(function () {
    paypal.remove();
  });
})();
