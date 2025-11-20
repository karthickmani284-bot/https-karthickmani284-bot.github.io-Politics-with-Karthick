/* Bill 24x7 - Frontend only (JSON/localStorage)
   - Admin user default: admin@tn / admin1998 (role: admin)
   - Data stored in localStorage keys: nb_users, nb_products, nb_sales
*/

const STORAGE_USERS = 'nb_users';
const STORAGE_PRODUCTS = 'nb_products';
const STORAGE_SALES = 'nb_sales';
const STORAGE_SESSION = 'nb_session';

const app = document.getElementById('app');

function tpl(id, data={}) {
  const t = document.getElementById(id).innerHTML;
  return t.replace(/\{\{(\w+)\}\}/g, (_, k)=> data[k] || '');
}

function save(key, v){ localStorage.setItem(key, JSON.stringify(v)); }
function load(key){ const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }

// initialize default data
function initDefault(){
  if(!load(STORAGE_USERS)){
    const admin = { email:'admin@tn', pass:'admin1998', first:'Admin', last:'User', role:'admin', expires: null };
    save(STORAGE_USERS, [admin]);
  }
  if(!load(STORAGE_PRODUCTS)){ save(STORAGE_PRODUCTS, [
    { sku:'SKU001', name:'Example Product', price:50, qty:20, barcode:'111222333' }
  ]); }
  if(!load(STORAGE_SALES)){ save(STORAGE_SALES, []); }
}

function showLogin(){
  app.innerHTML = tpl('tpl-login');
  document.getElementById('go-signup').onclick = ()=> showSignup();
  document.getElementById('form-login').onsubmit = (e)=>{
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const users = load(STORAGE_USERS)||[];
    const u = users.find(x=>x.email===email && x.pass===pass);
    if(!u){ return alert('Wrong credentials'); }
    // expiry check
    if(u.expires && new Date(u.expires) < new Date()){ return alert('Account expired'); }
    setSession(u.email);
    showApp();
  };
}

function showSignup(){
  app.innerHTML = tpl('tpl-signup');
  document.getElementById('back-login').onclick = ()=> showLogin();
  document.getElementById('form-signup').onsubmit = (e)=> {
    e.preventDefault();
    const first = document.getElementById('su-first').value.trim();
    const last = document.getElementById('su-last').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const pass = document.getElementById('su-pass').value.trim();
    const phone = document.getElementById('su-phone').value.trim();
    const location = document.getElementById('su-location').value.trim();
    const users = load(STORAGE_USERS)||[];
    if(users.find(u=>u.email===email)) return alert('User exists');
    const newu = { email, pass, first, last, phone, location, role:'staff', expires:null };
    users.push(newu); save(STORAGE_USERS, users);
    alert('Account created. Login now.');
    showLogin();
  };
}

function setSession(email){
  save(STORAGE_SESSION, { email, ts: Date.now() });
}

function getSession(){
  return load(STORAGE_SESSION);
}

function clearSession(){
  localStorage.removeItem(STORAGE_SESSION);
}

function getCurrentUser(){
  const s = getSession(); if(!s) return null;
  const users = load(STORAGE_USERS)||[]; return users.find(u=>u.email===s.email) || null;
}

function renderNav(user){
  const nav = tpl('tpl-nav', { userName: user.first + ' ' + (user.last||''), role:user.role });
  return nav;
}

function showApp(){
  const user = getCurrentUser(); if(!user) return showLogin();
  app.innerHTML = renderNav(user) + tpl('tpl-dashboard');
  document.getElementById('btn-logout').onclick = ()=>{
    clearSession(); showLogin();
  };
  document.getElementById('open-billing').onclick = ()=> loadBilling();
  document.getElementById('open-products').onclick = ()=> loadProducts();
  document.getElementById('open-users').onclick = ()=> loadUsers();
  document.getElementById('open-reports').onclick = ()=> loadReports();

  // CSV import/export
  document.getElementById('csv-input').onchange = (e)=> {
    window._csvFile = e.target.files[0];
  };
  document.getElementById('import-csv').onclick = ()=> {
    if(!window._csvFile) return alert('Select CSV first');
    const reader = new FileReader();
    reader.onload = (ev)=> {
      const text = ev.target.result;
      const rows = text.trim().split(/\r?\n/).map(r=>r.split(','));
      const products = load(STORAGE_PRODUCTS)||[];
      rows.forEach(cols=>{
        const [sku,name,price,qty,barcode] = cols.map(s=>s && s.trim());
        if(!sku) return;
        products.push({ sku, name, price: parseFloat(price||0), qty: parseInt(qty||0), barcode: barcode||'' });
      });
      save(STORAGE_PRODUCTS, products); alert('Imported '+rows.length+' rows'); loadProducts();
    };
    reader.readAsText(window._csvFile);
  };
  document.getElementById('export-products').onclick = ()=> {
    const p = load(STORAGE_PRODUCTS)||[]; downloadJSON(p,'products.json');
  };
  document.getElementById('backup-json').onclick = ()=> {
    const data = { users: load(STORAGE_USERS), products: load(STORAGE_PRODUCTS), sales: load(STORAGE_SALES) };
    downloadJSON(data, 'nammo_data.json');
  };
  document.getElementById('restore-json').onclick = ()=> {
    document.getElementById('restore-file').click();
  };
  document.getElementById('restore-file').onchange = (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = (ev)=> {
      try{
        const o = JSON.parse(ev.target.result);
        if(o.users) save(STORAGE_USERS, o.users);
        if(o.products) save(STORAGE_PRODUCTS, o.products);
        if(o.sales) save(STORAGE_SALES, o.sales);
        alert('Restored JSON. Refreshing page.');
        location.reload();
      }catch(err){ alert('Invalid JSON'); }
    }; r.readAsText(f);
  };

  // quick initial
  loadBilling();
}

// ---------- Products UI ----------
function loadProducts(){
  document.getElementById('right-panel').innerHTML = tpl('tpl-products');
  const products = load(STORAGE_PRODUCTS)||[];
  const tbody = document.querySelector('#products-table tbody'); tbody.innerHTML = '';
  products.forEach((p, i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.sku}</td><td>${p.name}</td><td>${p.price.toFixed(2)}</td><td>${p.qty}</td><td>${p.barcode||''}</td>
      <td>
        <button class="btn small edit" data-i="${i}">Edit</button>
        <button class="btn small del" data-i="${i}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('add-product-btn').onclick = ()=> showProductForm();

  tbody.onclick = (ev)=>{
    const t = ev.target;
    if(t.classList.contains('edit')){
      const i = parseInt(t.dataset.i); showProductForm(i);
    } else if(t.classList.contains('del')){
      const i = parseInt(t.dataset.i);
      if(confirm('Delete product?')){ const ps = load(STORAGE_PRODUCTS); ps.splice(i,1); save(STORAGE_PRODUCTS, ps); loadProducts(); }
    }
  };

  // form handlers
  window.showProductForm = function(idx){
    document.getElementById('product-form').style.display='block';
    const title = document.getElementById('product-form-title');
    if(idx==null){ title.textContent='Add Product'; document.getElementById('form-product').dataset.idx = ''; clearProductForm(); }
    else { title.textContent='Edit Product'; document.getElementById('form-product').dataset.idx = idx; fillProductForm(load(STORAGE_PRODUCTS)[idx]); }
  };
  document.getElementById('cancel-product').onclick = ()=> { document.getElementById('product-form').style.display='none'; };

  document.getElementById('form-product').onsubmit = (e)=>{
    e.preventDefault();
    const sku = document.getElementById('p-sku').value.trim();
    const name = document.getElementById('p-name').value.trim();
    const price = parseFloat(document.getElementById('p-price').value) || 0;
    const qty = parseInt(document.getElementById('p-qty').value) || 0;
    const barcode = document.getElementById('p-barcode').value.trim();
    const idx = document.getElementById('form-product').dataset.idx;
    const ps = load(STORAGE_PRODUCTS)||[];
    if(idx===''){ ps.push({ sku, name, price, qty, barcode }); }
    else { ps[idx] = { sku, name, price, qty, barcode }; }
    save(STORAGE_PRODUCTS, ps); document.getElementById('product-form').style.display='none'; loadProducts();
  };

  function clearProductForm(){ document.getElementById('p-sku').value=''; document.getElementById('p-name').value=''; document.getElementById('p-price').value='0'; document.getElementById('p-qty').value='0'; document.getElementById('p-barcode').value=''; }
  function fillProductForm(p){ document.getElementById('p-sku').value=p.sku; document.getElementById('p-name').value=p.name; document.getElementById('p-price').value=p.price; document.getElementById('p-qty').value=p.qty; document.getElementById('p-barcode').value=p.barcode; }
}

// ---------- Users UI ----------
function loadUsers(){
  const user = getCurrentUser();
  if(!user || user.role!=='admin'){ return alert('Only admin can manage users'); }
  document.getElementById('right-panel').innerHTML = tpl('tpl-users');
  const tbody = document.querySelector('#users-table tbody'); tbody.innerHTML='';
  const users = load(STORAGE_USERS)||[];
  users.forEach((u,i)=>{
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${u.email}</td><td>${u.first} ${u.last||''}</td><td>${u.role}</td><td>${u.expires||''}</td>
      <td><button class="btn small edit" data-i="${i}">Edit</button> <button class="btn small del" data-i="${i}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('create-user-btn').onclick = ()=> showUserForm();
  tbody.onclick = (ev)=>{
    const t = ev.target;
    if(t.classList.contains('edit')){ showUserForm(parseInt(t.dataset.i)); }
    else if(t.classList.contains('del')){ const i=parseInt(t.dataset.i); if(confirm('Delete user?')){ const us=load(STORAGE_USERS); us.splice(i,1); save(STORAGE_USERS,us); loadUsers(); } }
  };

  window.showUserForm = function(idx){
    document.getElementById('user-form').style.display='block';
    if(idx==null){ document.getElementById('user-form-title').textContent='Create User'; document.getElementById('form-user').dataset.idx=''; document.getElementById('u-email').value=''; document.getElementById('u-first').value=''; document.getElementById('u-last').value=''; document.getElementById('u-pass').value=''; document.getElementById('u-role').value='staff'; document.getElementById('u-expiry').value=''; }
    else {
      const users = load(STORAGE_USERS); const u = users[idx];
      document.getElementById('user-form-title').textContent='Edit User';
      document.getElementById('form-user').dataset.idx = idx;
      document.getElementById('u-email').value = u.email;
      document.getElementById('u-first').value = u.first || '';
      document.getElementById('u-last').value = u.last || '';
      document.getElementById('u-pass').value = u.pass || '';
      document.getElementById('u-role').value = u.role || 'staff';
      document.getElementById('u-expiry').value = u.expires ? (new Date(u.expires)).toISOString().slice(0,10) : '';
    }
  };
  document.getElementById('cancel-user').onclick = ()=> document.getElementById('user-form').style.display='none';
  document.getElementById('form-user').onsubmit = (e)=> {
    e.preventDefault();
    const idx = document.getElementById('form-user').dataset.idx;
    const email = document.getElementById('u-email').value.trim();
    const first = document.getElementById('u-first').value.trim();
    const last = document.getElementById('u-last').value.trim();
    const pass = document.getElementById('u-pass').value.trim();
    const role = document.getElementById('u-role').value;
    const expiry = document.getElementById('u-expiry').value || null;
    const users = load(STORAGE_USERS) || [];
    if(idx===''){ if(users.find(u=>u.email===email)) return alert('Email exists'); users.push({ email, pass, first, last, role, expires: expiry }); }
    else { users[idx] = { email, pass, first, last, role, expires: expiry }; }
    save(STORAGE_USERS, users); loadUsers();
  };
}

// ---------- Billing UI ----------
function loadBilling(){
  document.getElementById('right-panel').innerHTML = tpl('tpl-billing');
  const products = load(STORAGE_PRODUCTS)||[];
  const cart = [];
  const tbody = document.querySelector('#cart-table tbody');

  function renderCart(){
    tbody.innerHTML = '';
    cart.forEach((c,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.sku}</td><td>${c.name}</td><td>${c.price.toFixed(2)}</td>
        <td><input class="cart-qty" data-i="${i}" type="number" value="${c.qty}" min="1" style="width:70px"/></td>
        <td>${(c.price*c.qty).toFixed(2)}</td>
        <td><button class="btn small rem" data-i="${i}">Remove</button></td>`;
      tbody.appendChild(tr);
    });
    attachCartEvents();
    recalc();
  }

  function attachCartEvents(){
    tbody.querySelectorAll('.cart-qty').forEach(el=>{
      el.onchange = (e)=>{ const i=parseInt(e.target.dataset.i); const v = parseInt(e.target.value)||1; cart[i].qty = v; renderCart(); };
    });
    tbody.querySelectorAll('.rem').forEach(b=> b.onclick = (e)=>{ const i=parseInt(e.target.dataset.i); cart.splice(i,1); renderCart(); });
  }

  function recalc(){
    const gstP = parseFloat(document.getElementById('bill-gst').value) || 0;
    const disc = parseFloat(document.getElementById('bill-discount').value) || 0;
    let subtotal = 0;
    cart.forEach(c=> subtotal += c.price * c.qty);
    const gstAmt = subtotal * gstP / 100;
    const total = subtotal + gstAmt - disc;
    document.getElementById('sub-total').textContent = subtotal.toFixed(2);
    document.getElementById('gst-amt').textContent = gstAmt.toFixed(2);
    document.getElementById('disc-amt').textContent = disc.toFixed(2);
    document.getElementById('total-amt').textContent = total.toFixed(2);
  }

  document.getElementById('search-product').oninput = (e)=>{
    const q = e.target.value.toLowerCase().trim();
    const found = products.filter(p=> p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode||'').includes(q));
    // show quick suggestions (simple)
    if(found.length===1 && q.length>2){
      addToCart(found[0]);
      e.target.value='';
    }
  };

  document.getElementById('scan-barcode').onclick = ()=>{
    const code = prompt('Enter barcode value');
    if(!code) return;
    const found = products.find(p=>p.barcode && p.barcode===code);
    if(found) addToCart(found);
    else alert('Product not found');
  };

  function addToCart(prod){
    const p = JSON.parse(JSON.stringify(prod)); p.qty = 1; cart.push(p); renderCart();
  }

  document.getElementById('finalise-bill').onclick = ()=>{
    if(cart.length===0) return alert('Cart empty');
    // check stock, reduce qty
    const ps = load(STORAGE_PRODUCTS)||[];
    for(const item of cart){
      const p = ps.find(x=>x.sku===item.sku);
      if(!p) return alert('Product missing: '+item.sku);
      if(p.qty < item.qty) return alert('Not enough stock for: '+p.name);
    }
    // reduce
    for(const item of cart){
      const p = ps.find(x=>x.sku===item.sku);
      p.qty -= item.qty;
    }
    save(STORAGE_PRODUCTS, ps);
    // record sale
    const sales = load(STORAGE_SALES)||[];
    const gstP = parseFloat(document.getElementById('bill-gst').value) || 0;
    const disc = parseFloat(document.getElementById('bill-discount').value) || 0;
    const subtotal = cart.reduce((s,i)=>s + i.price*i.qty, 0);
    const gstAmt = subtotal * gstP /100;
    const total = subtotal + gstAmt - disc;
    const sale = { id:'S'+Date.now(), ts: new Date().toISOString(), user: getCurrentUser().email, customer: document.getElementById('bill-customer').value||'', items: cart, subtotal, gstP, gstAmt, discount:disc, total };
    sales.push(sale); save(STORAGE_SALES, sales);
    alert('Sale completed. Invoice ID: '+sale.id);
    // clear
    cart.splice(0, cart.length); renderCart(); loadProducts(); // refresh product list UI
  };

  document.getElementById('clear-cart').onclick = ()=> { if(confirm('Clear cart?')){ cart.splice(0,cart.length); renderCart(); } };
  document.getElementById('print-bill').onclick = ()=> {
    const html = `
      <html><head><title>Invoice</title><style>body{font-family:Arial;padding:12px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid #ccc}</style></head>
      <body><h2>Nammo Billing</h2><div>Customer: ${document.getElementById('bill-customer').value||''}</div>
      <table><thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>Qty</th><th>Line</th></tr></thead><tbody>
      ${cart.map(it=>`<tr><td>${it.sku}</td><td>${it.name}</td><td>${it.price.toFixed(2)}</td><td>${it.qty}</td><td>${(it.price*it.qty).toFixed(2)}</td></tr>`).join('')}
      </tbody></table>
      <div>Subtotal: ${document.getElementById('sub-total').textContent}</div>
      <div>GST: ${document.getElementById('gst-amt').textContent}</div>
      <div>Discount: ${document.getElementById('disc-amt').textContent}</div>
      <div><b>Total: ${document.getElementById('total-amt').textContent}</b></div>
      </body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
  };

  // initial
  renderCart();
}

// ---------- Reports ----------
function loadReports(){
  document.getElementById('right-panel').innerHTML = tpl('tpl-reports');
  const sales = load(STORAGE_SALES) || [];
  const repDiv = document.getElementById('reports-area'); repDiv.innerHTML = '';
  const today = new Date().toISOString().slice(0,10);
  let total=0; sales.forEach(s=> total+=s.total||0);
  repDiv.innerHTML = `<div class="card"><h4>Sales (${sales.length})</h4>
    <div>Total Revenue: ₹${total.toFixed(2)}</div>
    <table class="table"><thead><tr><th>ID</th><th>Date</th><th>User</th><th>Total</th></tr></thead><tbody>
    ${sales.map(s=>`<tr><td>${s.id}</td><td>${s.ts}</td><td>${s.user}</td><td>${(s.total).toFixed(2)}</td></tr>`).join('')}
    </tbody></table></div>`;
  document.getElementById('export-sales').onclick = ()=> { downloadJSON(sales, 'sales.json'); };
}

// ---------- Utilities ----------
function downloadJSON(obj, filename='data.json'){
  const blob = new Blob([JSON.stringify(obj,null,2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Start ----------
initDefault();
if(getSession()) showApp(); else showLogin();

// expose loadProducts for cart refresh
window.loadProducts = loadProducts;
