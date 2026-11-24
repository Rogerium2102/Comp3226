const grid = document.querySelector('#site-grid');
const response = await fetch('/api/sites', { cache: 'no-store' });
const sites = await response.json();
for (const site of sites) {
  const link = document.createElement('a');
  link.className = 'site-card';
  link.href = `/sites/${site.id}/`;
  const num = document.createElement('span');
  num.className = 'site-card-number';
  num.textContent = site.num;
  const meta = document.createElement('span');
  meta.className = 'site-card-meta';
  meta.textContent = site.category;
  const name = document.createElement('h2');
  name.textContent = site.name;
  const description = document.createElement('p');
  description.textContent = site.summary;
  const footer = document.createElement('span');
  footer.className = 'site-card-footer';
  footer.textContent = `${site.brand}  ·  Open test site →`;
  link.append(num, meta, name, description, footer);
  grid.append(link);
}
