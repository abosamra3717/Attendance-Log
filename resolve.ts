import https from 'https';

https.get('https://maps.app.goo.gl/dn4mAZUHxAcqMPmf6', (res) => {
  console.log('Location:', res.headers.location);
});
