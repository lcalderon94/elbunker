import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// API SERVICE — Conexión con el backend NestJS
// ============================================================
const API = '/api';

async function apiFetch(endpoint, options = {}) {
  const url = API + endpoint;
  const config = { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options };
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('elbunker_token') : null;
  if (token) config.headers = { ...config.headers, Authorization: 'Bearer ' + token };
  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Error ' + res.status);
    return data;
  } catch (err) {
    console.warn('[API]', endpoint, err.message);
    return null;
  }
}

const api = {
  customer: {
    register: (data) => apiFetch('/customer/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => apiFetch('/customer/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => apiFetch('/customer/me'),
    updateProfile: (data) => apiFetch('/customer/me', { method: 'PATCH', body: JSON.stringify(data) }),
    changePassword: (data) => apiFetch('/customer/change-password', { method: 'POST', body: JSON.stringify(data) }),
    reservations: () => apiFetch('/customer/reservations'),
  },
  chat: (message, history) => apiFetch('/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),
  zones: {
    getAll: () => apiFetch('/zones'),
    getAvailability: (slug, date, hour, duration = 2) => apiFetch('/zones/' + slug + '/availability?date=' + date + '&hour=' + hour + '&duration=' + duration),
  },
  reservations: {
    create: (data) => apiFetch('/reservations', { method: 'POST', body: JSON.stringify(data) }),
    specialRequest: (data) => apiFetch('/reservations/special-request', { method: 'POST', body: JSON.stringify(data) }),
    cancel: (token, email) => apiFetch('/reservations/' + token, { method: 'DELETE', body: JSON.stringify({ email }) }),
  },
  games: {
    search: (params) => { const q = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); }); return apiFetch('/games?' + q); },
    getById: (id) => apiFetch('/games/' + id),
    getTypes: () => apiFetch('/games/types'),
  },
};

// API HOOKS
function useApiZones(mockFloor) {
  const [zones, setZones] = useState(null);
  useEffect(() => {
    api.zones.getAll().then(data => {
      if (!data) { setZones(mockFloor); return; }
      const map = {};
      data.forEach(z => {
        map[z.slug] = { name: z.name, w: z.mapWidth, h: z.mapHeight, furniture: z.furniture || [],
          tables: z.tables.map(t => ({ id: t.code, seats: t.seats, x: t.posX, y: t.posY, w: t.width, h: t.height, shape: t.shape, label: t.label, adj: t.adjacentIds })),
        };
      });
      setZones(map);
    });
  }, []);
  return zones || mockFloor;
}

function useOccupiedAPI(zone, date, hour, duration = 2) {
  const [occ, setOcc] = useState([]);
  useEffect(() => {
    if (!zone || !date || !hour) { setOcc([]); return; }
    api.zones.getAvailability(zone, date, hour, duration).then(data => {
      if (data) setOcc(data.tables.filter(t => t.isOccupied).map(t => t.code));
      else setOcc(getOccupied(date, hour, zone));
    });
  }, [zone, date, hour, duration]);
  return occ;
}

// AUTH HOOK
function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('elbunker_token') : null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (token) {
      localStorage.setItem('elbunker_token', token);
      api.customer.me().then(data => {
        if (data) setUser(data); else { setToken(null); localStorage.removeItem('elbunker_token'); }
      }).finally(() => setLoading(false));
    } else { localStorage.removeItem('elbunker_token'); setUser(null); setLoading(false); }
  }, [token]);
  const login = async (email, password) => { const res = await api.customer.login({ email, password }); if (res && res.token) { setToken(res.token); setUser(res.customer); return res; } throw new Error('Error de login'); };
  const register = async (email, password, name, phone) => { const res = await api.customer.register({ email, password, name, phone }); if (res && res.token) { setToken(res.token); setUser(res.customer); return res; } throw new Error('Error de registro'); };
  const logout = () => { setToken(null); setUser(null); };
  return { user, token, loading, login, register, logout, isLoggedIn: !!user };
}



// ============================================================
// REAL MENU DATA (from El Búnker PDF)
// ============================================================
const MENU = {
  entrantes: [
    { name: "Crazy Nachos", price: "13,95 €", desc: "Trozos de maíz con queso fundido, frijoles negros, jalapeños, pico de gallo, sour cream y guacamole", vegan: true },
    { name: "Patatas con Mysterium", price: "12,50 €", desc: "Patatas fritas con queso fundido, bacon, salchichas y sour cream" },
    { name: "Tequeños de Castronegro", price: "9,35 €", desc: "Tequeños de queso blanco con salsa de ajo", vegan: true },
    { name: "Wingspan Fingers", price: "9,50 €", desc: "Fingers de pollo con salsa barbacoa", vegan: true },
    { name: "Speed Cups con Salsas", price: "9,90 €", desc: "Patatas gajo especiadas con salsas variadas", vegan: true },
    { name: "Quesadilla de Trivial", price: "7,95 €", desc: "Wrap, guacamole, cebolla frita, queso cheddar y crema agria", vegan: true },
    { name: "¡Guacamole!", price: "7,95 €", desc: "Dips de trigo y guacamole casero", vegan: true },
  ],
  burgers: [
    { name: "Modo Clásico!", price: "12,50 €", desc: "Pan brioche, carne de ternera Angus, queso cheddar, bacon, lechuga, tomate y cebolla" },
    { name: "Modo Casual", price: "13,50 €", desc: "Pan brioche, pechuga de pollo, queso cheddar, bacon, cebolla, lechuga, tomate y salsa miel y mostaza" },
    { name: "Modo Extremo", price: "13,50 €", desc: "Pan brioche, carne de ternera Angus, bacon, jalapeños, lechuga, tomate y salsa picante" },
    { name: "Modo Avanzado", price: "13,75 €", desc: "Pan brioche, carne de ternera Angus, queso de cabra y cebolla caramelizada" },
    { name: "Modo Experto", price: "13,75 €", desc: "Pan brioche, carne de ternera Angus, queso cheddar, bacon, cebolla caramelizada, lechuga y salsa miel y mostaza" },
    { name: "Modo Alternativo", price: "13,95 €", desc: "Pan grill, carne Heura, cebolla caramelizada, lechuga, tomate y guacamole", vegan: true },
  ],
  hotdogs: [
    { name: "Hotdog Piko Piko", price: "13,95 €", desc: "Pan brioche, queso fundido, pollo asado, bacon, lechuga y salsa barbacoa", vegan: true },
    { name: "Exploding Hotdog", price: "9,50 €", desc: "Pan brioche, salchicha, guacamole, pico de gallo, salsa picante y chips de totopos", vegan: true },
    { name: "Throw Throw Hotdog", price: "9,50 €", desc: "Pan brioche, salchicha, queso fundido, bacon, cebolla frita y salsa barbacoa" },
    { name: "Hotdog Agrícola Heura", price: "9,40 €", desc: "Pan brioche, guacamole, Heura, cebolla frita y tomate", vegan: true },
  ],
  bebidas: [
    { name: "Coca-Cola", price: "2,90 €", desc: "Original, Zero y Zero-Zero" },
    { name: "Fanta", price: "2,90 €", desc: "Naranja, limón" },
    { name: "Aquarius", price: "3,00 €" },
    { name: "Fuze Tea", price: "3,00 €" },
    { name: "Tónica", price: "2,90 €" },
    { name: "Agua", price: "2,00 €" },
    { name: "Agua con gas", price: "2,50 €", desc: "Naranja, piña, melocotón" },
    { name: "Tinto de Verano", price: "4,00 €", desc: "Con limón" },
    { name: "Monster Verde", price: "3,50 €", desc: "235ml" },
  ],
  cervezas: [
    { name: "Tercio Mahou 5 Estrellas", price: "3,75 €" },
    { name: "Tercio Mahou Tostada", price: "3,75 €" },
    { name: "Mahou Sin Gluten", price: "4,65 €", desc: "Tercio Estrellas" },
    { name: "Cerveza Artesana CCVK", price: "5,00 €", desc: "Tercio" },
    { name: "1/2 Pinta Mahou Clásica", price: "2,50 €" },
    { name: "Pinta Mahou Clásica", price: "4,25 €" },
    { name: "Hidromiel Viking Bad", price: "6,30 €" },
    { name: "Copa Vino Tinto", price: "3,70 €" },
    { name: "Copa Vino Blanco", price: "3,75 €" },
    { name: "Copas Espirituosas", price: "5,00 €", desc: "Ron, whisky y ginebra" },
  ],
  especiales: [
    { name: "Bunker Cola 350ml", price: "8,90 €", desc: "La bebida postapocalíptica original" },
    { name: "Bunker Cola 500ml", price: "12,90 €", desc: "Tamaño superviviente" },
    { name: "Bunker Cherry 350ml", price: "8,90 €", desc: "Sabor cereza del yermo" },
    { name: "Bunker Cherry 500ml", price: "12,90 €", desc: "Tamaño superviviente" },
    { name: "Estus Flask", price: "—", desc: "Elixir místico de tierras oscuras... ¡Pregunta en barra!" },
  ],
  postres: [
    { name: "Pingüino de Vainilla", price: "6,75 €", desc: "Helado de vainilla con nata, sirope de chocolate y crumble de galleta", vegan: true },
    { name: "Pingüino de Chocolate", price: "6,75 €", desc: "Helado de chocolate con nata, sirope de chocolate blanco y crumble de galleta", vegan: true },
    { name: "Cacao Coulant", price: "7,75 €", desc: "Coulant con helado de vainilla y nata", vegan: true },
    { name: "Gofres Against Humanity", price: "8,50 €", desc: "Gofre con helado de vainilla y sirope de chocolate", vegan: true },
    { name: "Cheese Cakes!", price: "8,50 €", desc: "Tarta de queso templado con sirope de chocolate blanco y crumble de galleta", vegan: true },
  ],
};

const GAMES = [
  { id:1, name:"Catan", type:"Estrategia", players:"3-4", duration:"75 min", diff:"Media", desc:"Coloniza la isla, comercia con tus rivales y construye el mejor asentamiento.", img:"warm" },
  { id:2, name:"Carcassonne", type:"Colocación", players:"2-5", duration:"45 min", diff:"Fácil", desc:"Coloca losetas, reclama ciudades y domina los campos medievales.", img:"cool" },
  { id:3, name:"Dixit", type:"Party", players:"3-8", duration:"30 min", diff:"Fácil", desc:"Deja volar tu imaginación con las ilustraciones más increíbles.", img:"coral" },
  { id:4, name:"Ticket to Ride", type:"Familiar", players:"2-5", duration:"60 min", diff:"Fácil", desc:"Construye rutas de tren y conecta ciudades por todo el mapa.", img:"green" },
  { id:5, name:"Azul", type:"Abstracto", players:"2-4", duration:"40 min", diff:"Media", desc:"Decora el palacio real con los mosaicos más bonitos y coloridos.", img:"cool" },
  { id:6, name:"Código Secreto", type:"Party", players:"4-8", duration:"20 min", diff:"Fácil", desc:"Pistas de una palabra para encontrar a tus espías.", img:"dark" },
  { id:7, name:"7 Wonders", type:"Estrategia", players:"3-7", duration:"30 min", diff:"Media", desc:"Construye una civilización y levanta una maravilla del mundo.", img:"warm" },
  { id:8, name:"Pandemic", type:"Cooperativo", players:"2-4", duration:"45 min", diff:"Media", desc:"Salva al mundo trabajando en equipo contra enfermedades mortales.", img:"coral" },
  { id:9, name:"Splendor", type:"Estrategia", players:"2-4", duration:"30 min", diff:"Fácil", desc:"Colecciona gemas preciosas y conviértete en el mejor comerciante.", img:"mixed" },
  { id:10, name:"King of Tokyo", type:"Party", players:"2-6", duration:"30 min", diff:"Fácil", desc:"Sé el monstruo más poderoso de la ciudad. ¡Conquista Tokio!", img:"green" },
  { id:11, name:"Wingspan", type:"Estrategia", players:"1-5", duration:"60 min", diff:"Media", desc:"Atrae las aves más valiosas a tu reserva natural.", img:"cool" },
  { id:12, name:"Dobble", type:"Party", players:"2-8", duration:"15 min", diff:"Fácil", desc:"Encuentra el símbolo que coincide. ¡Velocidad pura!", img:"warm" },
];

const FAQ = [
  { q:"¿Cómo funciona El Búnker?", a:"Reservas tu mesa, vienes con tu grupo, pides algo de nuestra carta, elegís un juego (o te ayudamos) y disfrutáis. Pagas un cover de 3,50€ por persona que incluye juegos ilimitados y sin límite de tiempo." },
  { q:"¿Necesito saber jugar?", a:"¡Para nada! Nuestro equipo te explica cualquier juego en minutos. Tenemos desde los más sencillos hasta los más desafiantes." },
  { q:"¿Puedo ir con niños?", a:"¡Por supuesto! Somos family friendly. Tenemos juegos para peques desde 4 años. Los menores deben ir acompañados de un adulto." },
  { q:"¿Es necesario reservar?", a:"Recomendamos reservar, especialmente fines de semana. Pero si hay disponibilidad, también te recibimos sin reserva." },
  { q:"¿Cuánto cuesta jugar?", a:"El cover es de 3,50€ por persona. Incluye acceso ilimitado a toda la colección, sin límite de tiempo. Comida y bebida aparte." },
  { q:"¿Puedo solo venir a comer?", a:"¡Claro! Puedes estar solo comiendo o disfrutando de nuestros juegos por 3,50€. Tú decides." },
  { q:"¿Puedo celebrar un cumpleaños?", a:"¡Sí! Tenemos packs especiales para cumples, afterworks y eventos privados. Contáctanos y lo montamos." },
  { q:"¿Cuántos juegos tenéis?", a:"Más de 500 juegos y creciendo. Estrategia, party, cooperativos, familiares, para dos, temáticos..." },
];

// ============================================================
// SVG ICONS
// ============================================================
const I = {
  dice: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><rect x="4" y="4" width="56" height="56" rx="12" fill={c}/><circle cx="20" cy="20" r="5" fill="#FFD60A"/><circle cx="44" cy="20" r="5" fill="#FFD60A"/><circle cx="32" cy="32" r="5" fill="#FFD60A"/><circle cx="20" cy="44" r="5" fill="#FFD60A"/><circle cx="44" cy="44" r="5" fill="#FFD60A"/></svg>,
  door: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><rect x="12" y="4" width="40" height="56" rx="4" fill={c}/><rect x="16" y="8" width="32" height="48" rx="2" fill="#FFD60A" opacity=".3"/><rect x="20" y="12" width="24" height="20" rx="2" fill="#FFD60A" opacity=".5"/><circle cx="40" cy="36" r="3" fill="#FFD60A"/><rect x="8" y="56" width="48" height="4" rx="2" fill={c}/></svg>,
  coffee: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><path d="M12 24h32v24c0 6-6 12-12 12h-8c-6 0-12-6-12-12V24z" fill={c}/><path d="M44 28h6c4 0 6 4 6 8s-2 8-6 8h-6" stroke={c} strokeWidth="4" fill="none"/><path d="M20 8c0 0 2 6 0 12M28 6c0 0 2 6 0 12M36 8c0 0 2 6 0 12" stroke="#FFD60A" strokeWidth="3" strokeLinecap="round"/></svg>,
  party: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><path d="M16 56L24 8h4l-6 48h-6z" fill="#FFD60A"/><path d="M24 8c12 0 20 8 20 16 0 4-4 8-10 8" fill={c}/><circle cx="44" cy="16" r="3" fill="#FF6B6B"/><circle cx="50" cy="24" r="2.5" fill="#FFD60A"/><circle cx="40" cy="10" r="2" fill="#00B4D8"/><circle cx="52" cy="18" r="2" fill="#A8E06C"/><path d="M8 20l4-4 4 4-4 4z" fill="#FF6B6B"/></svg>,
  star: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><path d="M32 4l8.5 17.5L60 24l-14 13.5L49 58 32 49 15 58l3-20.5L4 24l19.5-2.5z" fill={c}/><path d="M32 14l5 10.5L48 26l-8 8 2 12-10-6-10 6 2-12-8-8 11-1.5z" fill="#FFD60A"/></svg>,
  map: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><path d="M32 56s-20-16-20-28C12 16 21 8 32 8s20 8 20 20c0 12-20 28-20 28z" fill={c}/><circle cx="32" cy="26" r="8" fill="#FFD60A"/></svg>,
  phone: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><rect x="16" y="4" width="32" height="56" rx="6" fill={c}/><rect x="20" y="12" width="24" height="36" rx="2" fill="#FFD60A" opacity=".3"/><circle cx="32" cy="54" r="3" fill="#FFD60A"/></svg>,
  burger: (s=48) => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><path d="M8 30h48c0-14-10-22-24-22S8 16 8 30z" fill="#E8A33C"/><rect x="6" y="30" width="52" height="6" rx="3" fill="#A8E06C"/><rect x="6" y="36" width="52" height="5" rx="2" fill="#FF6B6B"/><rect x="6" y="41" width="52" height="5" rx="2" fill="#FFD60A"/><path d="M8 46h48v4c0 3-3 6-6 6H14c-3 0-6-3-6-6v-4z" fill="#E8A33C"/></svg>,
  cake: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><rect x="10" y="28" width="44" height="24" rx="4" fill={c}/><rect x="14" y="20" width="36" height="10" rx="4" fill="#FF6B6B"/><path d="M10 38h44" stroke="#FFD60A" strokeWidth="3"/><rect x="28" y="8" width="8" height="14" rx="2" fill="#FFD60A"/><ellipse cx="32" cy="6" rx="4" ry="3" fill="#FF6B6B"/></svg>,
  people: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><circle cx="22" cy="18" r="8" fill={c}/><path d="M8 48c0-10 6-16 14-16s14 6 14 16" fill={c}/><circle cx="42" cy="18" r="8" fill="#FFD60A"/><path d="M28 48c0-10 6-16 14-16s14 6 14 16" fill="#FFD60A"/></svg>,
  heart: (s=48,c="#FF6B6B") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><path d="M32 56S4 36 4 20C4 10 12 4 20 4c6 0 10 4 12 8 2-4 6-8 12-8 8 0 16 6 16 16 0 16-28 36-28 36z" fill={c}/></svg>,
  clock: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" fill={c}/><circle cx="32" cy="32" r="22" fill="#FFD60A" opacity=".3"/><line x1="32" y1="32" x2="32" y2="16" stroke="#FFD60A" strokeWidth="4" strokeLinecap="round"/><line x1="32" y1="32" x2="44" y2="32" stroke="#FFD60A" strokeWidth="3" strokeLinecap="round"/><circle cx="32" cy="32" r="3" fill="#FFD60A"/></svg>,
  hotdog: (s=48) => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><ellipse cx="32" cy="36" rx="24" ry="12" fill="#E8A33C"/><ellipse cx="32" cy="32" rx="20" ry="8" fill="#D84315"/><path d="M14 28c6 4 12-2 18 2s12-2 18 2" stroke="#FFD60A" strokeWidth="3" fill="none"/><path d="M16 32c5 3 10-2 16 2s10-2 16 2" stroke="#A8E06C" strokeWidth="2" fill="none"/></svg>,
  beer: (s=48) => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><rect x="14" y="16" width="28" height="40" rx="4" fill="#FFD60A" opacity=".7"/><rect x="14" y="16" width="28" height="12" rx="4" fill="#FFF" opacity=".5"/><path d="M42 24h8c4 0 6 4 6 8s-2 8-6 8h-8" stroke="#E8A33C" strokeWidth="3" fill="none"/><rect x="14" y="12" width="28" height="6" rx="3" fill="#E8A33C"/></svg>,
  bottle: (s=48) => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><rect x="24" y="4" width="16" height="8" rx="2" fill="#8B5E3C"/><rect x="20" y="12" width="24" height="44" rx="6" fill="#C62828"/><rect x="24" y="20" width="16" height="16" rx="8" fill="#FFD60A" opacity=".3"/><circle cx="32" cy="28" r="6" fill="#FFD60A" opacity=".5"/></svg>,
  mail: (s=22) => <svg width={s} height={s} viewBox="0 0 22 22"><rect x="1" y="4" width="20" height="14" rx="3" fill="#1A1A2E"/><path d="M1 7l10 6 10-6" stroke="#FFD60A" strokeWidth="2" fill="none"/></svg>,
  gamepad: (s=48,c="#2D2D2D") => <svg width={s} height={s} viewBox="0 0 64 64" fill="none"><path d="M8 28C8 20 14 14 22 14h20c8 0 14 6 14 14v4c0 10-6 18-14 22H22C14 50 8 42 8 32v-4z" fill={c}/><rect x="18" y="24" width="4" height="14" rx="2" fill="#FFD60A"/><rect x="13" y="29" width="14" height="4" rx="2" fill="#FFD60A"/><circle cx="44" cy="26" r="3.5" fill="#FFD60A"/><circle cx="44" cy="36" r="3.5" fill="#FFD60A"/></svg>,
};

// Logo placeholder component
function LogoMascot({ size = 40 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "2px 2px 0 rgba(0,0,0,.2)", overflow: "hidden", flexShrink: 0 }}><span style={{ fontSize: size * 0.45, fontFamily: "'Lilita One',sans-serif", color: "var(--black)" }}>EB</span></div>;
}

function MockImg({ label, grad, h = 200, round = true }) {
  const gs = { warm:"linear-gradient(135deg,#8B5E3C,#E8A33C,#FFD60A)", cool:"linear-gradient(135deg,#0077B6,#00B4D8,#90E0EF)", green:"linear-gradient(135deg,#33691E,#558B2F,#7CB342)", coral:"linear-gradient(135deg,#BF360C,#E64A19,#FF8A65)", dark:"linear-gradient(135deg,#1A1A2E,#2D2D44,#4A4A60)", mixed:"linear-gradient(135deg,#FFD60A,#FF6B6B,#B388FF)" };
  return <div style={{ width:"100%", height:h, background:gs[grad]||gs.warm, borderRadius:round?16:0, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}><div style={{ position:"absolute", inset:0, opacity:.1, backgroundImage:`url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='1' fill='%23fff'/%3E%3C/svg%3E")`, backgroundSize:"20px 20px" }}/><span style={{ color:"rgba(255,255,255,.8)", fontFamily:"'Lilita One',sans-serif", fontSize:".85rem", textAlign:"center", padding:"1rem", textShadow:"1px 2px 4px rgba(0,0,0,.4)" }}>{label}</span></div>;
}

// ============================================================
// ROADMAP COMPONENT (board-game path style)
// ============================================================
function Roadmap() {
  const steps = [
    { num: 1, icon: I.door(52), title: "Entra", desc: "Ven al Búnker con tu grupo y te acompañamos a tu mesa", color: "#00B4D8" },
    { num: 2, icon: I.coffee(52), title: "Pide algo", desc: "Echa un vistazo a nuestra carta y haz tu pedido mientras eliges juego", color: "#FF6B6B" },
    { num: 3, icon: I.dice(52), title: "Elige juego", desc: "Escoge de la estantería o déjate aconsejar por el equipo", color: "#FFD60A" },
    { num: 4, icon: I.party(52), title: "¡Diviértete!", desc: "Juega sin límite de tiempo ni de juegos. A pasarlo bien", color: "#7CB342" },
  ];
  return (
    <div className="roadmap">
      <div className="roadmap-path">
        {steps.map((s, i) => (
          <div key={i} className={`roadmap-stop ${i % 2 === 1 ? "offset" : ""}`}>
            <div className="roadmap-connector">{i < steps.length - 1 && <svg className="roadmap-line" viewBox="0 0 100 60" preserveAspectRatio="none"><path d={i % 2 === 0 ? "M50 0 C50 20, 80 30, 80 60" : "M50 0 C50 20, 20 30, 20 60"} stroke={s.color} strokeWidth="4" fill="none" strokeDasharray="8 4" opacity=".4" /></svg>}</div>
            <div className="roadmap-node" style={{ borderColor: s.color }}>
              <div className="roadmap-num" style={{ background: s.color }}>{s.num}</div>
              <div className="roadmap-icon">{s.icon}</div>
              <h3 style={{ color: s.color }}>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="roadmap-cover">
        <span style={{ fontSize: "1.6rem" }}>🎫</span>
        <div>
          <strong>Cover: 3,50 € / persona</strong>
          <span>Juegos ilimitados · Sin límite de tiempo</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HERO CAROUSEL
// ============================================================
function HeroCarousel({ setPage }) {
  const slides = [
    { title:"Bienvenido a", hl:"El Búnker", sub:"Juegos de mesa, comida increíble y el mejor ambiente. Tu plan perfecto con amigos, familia o pareja.", bg:"linear-gradient(135deg,#1A1A2E 0%,#2D2D44 60%,#3D3D5C 100%)" },
    { title:"Más de", hl:"500 Juegos", sub:"Estrategia, party, cooperativos, familiares... Encuentra tu favorito y juega sin límite de tiempo.", bg:"linear-gradient(135deg,#0077B6 0%,#00B4D8 60%,#90E0EF 100%)" },
    { title:"¡Ven a comer...", hl:"Quédate a jugar!", sub:"Crazy Nachos, Burgers, Hotdogs, Bunker Cola... Combustible premium para las mejores partidas.", bg:"linear-gradient(135deg,#8B5E3C 0%,#E8A33C 60%,#FFD60A 100%)" },
  ];
  const [idx, setIdx] = useState(0);
  const t = useRef(null);
  const start = useCallback(() => { clearInterval(t.current); t.current = setInterval(() => setIdx(i => (i + 1) % slides.length), 5000); }, [slides.length]);
  useEffect(() => { start(); return () => clearInterval(t.current); }, [start]);
  const go = p => { setPage(p); window.scrollTo(0, 0); };
  return (
    <div className="hero-carousel">
      {slides.map((s, i) => <div key={i} className={`hero-slide ${i === idx ? "active" : ""}`} style={{ background: s.bg }}><div className="hero-content"><div className="hero-badge">Board Game Café · Madrid</div><h1>{s.title}<br /><span className="hero-hl">{s.hl}</span></h1><p>{s.sub}</p><div className="hero-btns"><button className="btn btn-yellow" onClick={() => go("reservas")}>¡Reserva tu mesa!</button><button className="btn btn-ghost" onClick={() => go("juegos")}>Ver juegos</button></div></div></div>)}
      <div className="dots">{slides.map((_, i) => <button key={i} className={`dot ${i === idx ? "on" : ""}`} onClick={() => { setIdx(i); start(); }} />)}</div>
    </div>
  );
}

// ============================================================
// CSS
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Quicksand:wght@400;500;600;700&display=swap');
:root{--yellow:#FFD60A;--yellow-dk:#E6C009;--yellow-lt:#FFF3B0;--black:#1A1A2E;--char:#2D2D44;--teal:#00B4D8;--teal-dk:#0096B7;--green:#7CB342;--coral:#FF6B6B;--cream:#FFF8E7;--cream-dk:#F0E8D0;--white:#FFF;--text:#1A1A2E;--tm:#4A4A60;--tl:#7A7A90;--sh:0 4px 20px rgba(26,26,46,.12);--shl:0 8px 40px rgba(26,26,46,.18);--shh:4px 4px 0 rgba(26,26,46,.15);--r:16px;--rl:24px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Quicksand',sans-serif;color:var(--text);background:var(--cream);overflow-x:hidden;font-weight:500}
h1,h2,h3,h4{font-family:'Lilita One',sans-serif;font-weight:400}
.rbg{position:relative;overflow:hidden}.rbg::before{content:'';position:absolute;inset:0;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Ccircle cx='40' cy='40' r='2' fill='%231A1A2E'/%3E%3Ccircle cx='40' cy='40' r='16' fill='none' stroke='%231A1A2E' stroke-width='.5'/%3E%3Ccircle cx='40' cy='40' r='30' fill='none' stroke='%231A1A2E' stroke-width='.3'/%3E%3C/svg%3E");background-size:80px;pointer-events:none;z-index:0}.rbg>*{position:relative;z-index:1}

/* NAV */
.nav{position:sticky;top:0;z-index:1000;background:var(--black);padding:0 2rem;display:flex;align-items:center;justify-content:space-between;height:72px;box-shadow:0 4px 20px rgba(0,0,0,.3)}
.nav-logo{display:flex;align-items:center;gap:12px;cursor:pointer}
.nav-brand{font-family:'Lilita One',sans-serif;font-size:1.4rem;color:var(--yellow)}
.nlinks{display:flex;align-items:center;gap:0}
.nl{padding:.5rem 1rem;color:rgba(255,255,255,.85);font-weight:700;font-size:.95rem;cursor:pointer;border-radius:10px;transition:all .2s;border:none;background:none}
.nl:hover,.nl.on{color:var(--yellow);background:rgba(255,215,10,.1)}
.ncta{background:var(--yellow)!important;color:var(--black)!important;padding:.55rem 1.4rem!important;border-radius:12px!important;box-shadow:var(--shh);margin-left:.5rem;font-family:'Lilita One',sans-serif!important;font-size:1rem!important}
.ncta:hover{background:var(--yellow-dk)!important;transform:translateY(-2px)}
.hmb{display:none;background:none;border:none;cursor:pointer}
@media(max-width:960px){.hmb{display:block}.nlinks{display:none;position:absolute;top:72px;left:0;right:0;background:var(--black);flex-direction:column;padding:1rem;box-shadow:0 8px 30px rgba(0,0,0,.4)}.nlinks.open{display:flex}.nl{width:100%;text-align:center;padding:.9rem}}

/* HERO */
.hero-carousel{position:relative;height:520px;overflow:hidden}@media(max-width:768px){.hero-carousel{height:480px}}
.hero-slide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .8s}.hero-slide.active{opacity:1}
.hero-slide::before{content:'';position:absolute;inset:0;opacity:.06;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle cx='50' cy='50' r='3' fill='%23fff'/%3E%3Ccircle cx='50' cy='50' r='20' fill='none' stroke='%23fff' stroke-width='.5'/%3E%3Ccircle cx='50' cy='50' r='38' fill='none' stroke='%23fff' stroke-width='.3'/%3E%3C/svg%3E");background-size:100px}
.hero-content{text-align:center;color:#fff;padding:2rem;max-width:700px;position:relative;z-index:2}
.hero-badge{display:inline-block;background:var(--yellow);color:var(--black);padding:.4rem 1.5rem;border-radius:50px;font-weight:700;font-size:.82rem;margin-bottom:1.5rem;box-shadow:var(--shh);letter-spacing:1.5px;text-transform:uppercase}
.hero-content h1{font-size:clamp(2.2rem,6vw,3.8rem);line-height:1.1;margin-bottom:1rem;text-shadow:3px 3px 0 rgba(0,0,0,.25)}
.hero-hl{color:var(--yellow);display:block;font-size:1.15em}
.hero-content p{font-size:clamp(1rem,2.5vw,1.15rem);opacity:.92;max-width:550px;margin:0 auto 2rem;font-weight:600;line-height:1.6}
.hero-btns{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.dots{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:10}
.dot{width:14px;height:14px;border-radius:50%;border:3px solid var(--yellow);background:transparent;cursor:pointer;transition:all .3s;padding:0}.dot.on{background:var(--yellow);transform:scale(1.2)}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.85rem 2rem;border-radius:14px;font-family:'Lilita One',sans-serif;font-size:1.1rem;cursor:pointer;border:none;transition:all .25s;box-shadow:var(--shh);letter-spacing:.3px}
.btn:hover{transform:translateY(-3px);box-shadow:5px 6px 0 rgba(0,0,0,.18)}
.btn-yellow{background:var(--yellow);color:var(--black)}.btn-yellow:hover{background:var(--yellow-dk)}
.btn-ghost{background:transparent;color:#fff;border:3px solid rgba(255,255,255,.7)}.btn-ghost:hover{background:rgba(255,255,255,.15);border-color:#fff}
.btn-dark{background:var(--black);color:var(--yellow)}.btn-dark:hover{background:var(--char)}
.btn-sm{padding:.5rem 1.2rem;font-size:.9rem;border-radius:10px}

/* INFO STRIPE */
.stripe{background:var(--yellow);padding:.7rem 2rem;display:flex;justify-content:center;gap:2.5rem;flex-wrap:wrap;font-weight:700;font-size:.8rem;color:var(--black);letter-spacing:.5px;text-transform:uppercase}
.stripe span{display:flex;align-items:center;gap:.4rem}

/* SECTIONS */
.sec{padding:5rem 2rem}.stitle{font-size:clamp(2rem,4.5vw,3rem);color:var(--black);text-align:center;margin-bottom:.5rem}
.stitle .yl{color:var(--yellow);-webkit-text-stroke:1px var(--black);paint-order:stroke fill}
.ssub{text-align:center;color:var(--tm);font-size:1.1rem;max-width:600px;margin:0 auto 3rem;font-weight:600}
.ctn{max-width:1200px;margin:0 auto}

/* ROADMAP */
.roadmap{max-width:900px;margin:0 auto}
.roadmap-path{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;position:relative}
@media(max-width:800px){.roadmap-path{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.roadmap-path{grid-template-columns:1fr}}
.roadmap-stop{display:flex;flex-direction:column;align-items:center;position:relative}
.roadmap-stop.offset{margin-top:2rem}
@media(max-width:800px){.roadmap-stop.offset{margin-top:0}}
.roadmap-connector{height:20px;position:relative;width:100%}
.roadmap-line{position:absolute;width:100%;height:60px;top:-10px}
.roadmap-node{background:var(--white);border-radius:var(--rl);padding:1.8rem 1.2rem 1.5rem;text-align:center;box-shadow:var(--sh);border:3px solid;transition:all .3s;position:relative;width:100%}
.roadmap-node:hover{transform:translateY(-6px);box-shadow:var(--shl)}
.roadmap-num{position:absolute;top:-16px;left:50%;transform:translateX(-50%);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Lilita One',sans-serif;font-size:1.1rem;color:var(--white);box-shadow:var(--shh);border:3px solid var(--white)}
.roadmap-icon{margin:.6rem 0 .8rem}
.roadmap-node h3{font-size:1.15rem;margin-bottom:.3rem}
.roadmap-node p{color:var(--tm);font-size:.88rem;font-weight:600;line-height:1.4}
.roadmap-cover{display:flex;align-items:center;gap:1rem;justify-content:center;margin-top:2.5rem;background:var(--black);border-radius:var(--r);padding:1rem 2rem;color:var(--yellow);font-family:'Lilita One',sans-serif}
.roadmap-cover strong{display:block;font-size:1.1rem}
.roadmap-cover span{display:block;font-family:'Quicksand',sans-serif;font-weight:600;font-size:.85rem;color:rgba(255,255,255,.6);margin-top:.2rem}

/* STAT BANNER */
.statb{background:var(--black);padding:4rem 2rem;text-align:center;color:#fff;position:relative;overflow:hidden}
.statb::before{content:'';position:absolute;inset:0;opacity:.06;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0l4 26L60 30l-26 4L30 60l-4-26L0 30l26-4z' fill='%23FFD60A'/%3E%3C/svg%3E");background-size:60px}
.statb>*{position:relative;z-index:1}
.statb h2{font-size:clamp(2.5rem,5vw,4rem);text-shadow:3px 3px 0 rgba(0,0,0,.3)}.statb .big{font-size:1.5em;color:var(--yellow)}
.statb p{font-size:1.2rem;opacity:.8;font-weight:600;margin-top:.5rem}

/* PROMO */
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:2rem}@media(max-width:860px){.pgrid{grid-template-columns:1fr}}
.pcard{background:var(--white);border-radius:var(--rl);overflow:hidden;box-shadow:var(--sh);border:3px solid transparent;transition:all .3s}
.pcard:hover{transform:translateY(-6px);border-color:var(--yellow);box-shadow:var(--shl)}
.pbody{padding:1.8rem}.pbody h3{font-size:1.4rem;color:var(--black);margin-bottom:.2rem;text-transform:uppercase;letter-spacing:1px}
.pbody h4{font-size:.9rem;color:var(--teal-dk);font-family:'Lilita One',sans-serif;margin-bottom:.6rem}
.pbody p{color:var(--tm);font-size:.9rem;line-height:1.5;font-weight:600;margin-bottom:1rem}

/* VISIT */
.visit{background:var(--teal);border-radius:var(--rl);padding:3.5rem;display:flex;align-items:center;gap:3rem;max-width:1000px;margin:0 auto;box-shadow:var(--shl);color:#fff;position:relative;overflow:hidden}
.visit::before{content:'';position:absolute;inset:0;opacity:.08;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0l4 26L60 30l-26 4L30 60l-4-26L0 30l26-4z' fill='%23fff'/%3E%3C/svg%3E");background-size:60px}
.visit>*{position:relative;z-index:1}.visit h2{font-size:2.2rem;margin-bottom:.5rem;text-shadow:2px 2px 0 rgba(0,0,0,.15)}
.visit p{font-size:1.05rem;opacity:.9;font-weight:600;margin-bottom:1.5rem;line-height:1.5}
.vmap{width:260px;height:180px;background:rgba(255,255,255,.15);border-radius:var(--r);display:flex;align-items:center;justify-content:center;flex-shrink:0}
@media(max-width:768px){.visit{flex-direction:column;text-align:center;padding:2.5rem}.vmap{width:100%}}

/* PAGE HEADER */
.ph{background:var(--black);padding:3.5rem 2rem 3rem;text-align:center;color:#fff;position:relative;overflow:hidden}
.ph::before{content:'';position:absolute;inset:0;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0l4 26L60 30l-26 4L30 60l-4-26L0 30l26-4z' fill='%23FFD60A'/%3E%3C/svg%3E");background-size:60px}
.ph>*{position:relative;z-index:1}.ph h1{font-size:clamp(2rem,4.5vw,3rem);text-shadow:3px 3px 0 rgba(0,0,0,.25);margin-bottom:.3rem;color:var(--yellow)}
.ph p{font-size:1.1rem;opacity:.8;font-weight:600}

/* GAMES */
.ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.5rem}@media(max-width:400px){.ggrid{grid-template-columns:1fr}}
.gc{background:var(--white);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh);transition:all .3s;border:3px solid transparent}
.gc:hover{transform:translateY(-4px);border-color:var(--yellow);box-shadow:var(--shl)}
.gi{padding:1.2rem 1.4rem}.gi h3{font-size:1.25rem;color:var(--black);margin-bottom:.3rem}
.gbadge{display:inline-block;background:var(--yellow);color:var(--black);padding:.1rem .6rem;border-radius:8px;font-size:.72rem;font-weight:700;margin-bottom:.5rem;letter-spacing:.5px;text-transform:uppercase}
.gm{display:flex;gap:1rem;margin-bottom:.5rem;flex-wrap:wrap}.gm span{font-size:.82rem;color:var(--tm);font-weight:700;display:flex;align-items:center;gap:3px}
.gi p{color:var(--tm);font-size:.88rem;line-height:1.4;font-weight:600}
.fbar{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:2.5rem}
.fbtn{padding:.4rem 1.1rem;border-radius:50px;border:3px solid var(--char);background:#fff;color:var(--black);font-weight:700;font-size:.88rem;cursor:pointer;transition:all .2s}
.fbtn:hover,.fbtn.on{background:var(--black);color:var(--yellow);border-color:var(--black)}

/* MENU */
.mcat{margin-bottom:3rem}.mchead{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:.7rem;border-bottom:4px solid var(--black)}
.mchead h3{font-size:1.5rem;color:var(--black);text-transform:uppercase;letter-spacing:1px}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:.8rem}
.mi{background:var(--white);border-radius:var(--r);padding:1.1rem 1.3rem;display:flex;justify-content:space-between;align-items:flex-start;box-shadow:0 2px 8px rgba(0,0,0,.05);transition:all .2s;border:2px solid transparent}
.mi:hover{border-color:var(--yellow);box-shadow:var(--sh);transform:translateY(-2px)}
.mi h4{font-family:'Lilita One',sans-serif;color:var(--black);font-size:1rem;margin-bottom:.2rem}
.mi .d{color:var(--tl);font-size:.82rem;font-weight:600}
.mp{font-family:'Lilita One',sans-serif;font-size:1.15rem;color:var(--teal-dk);white-space:nowrap;background:var(--yellow-lt);padding:.25rem .7rem;border-radius:8px;flex-shrink:0;margin-left:.8rem}
.mi .vbadge{display:inline-block;width:14px;height:14px;background:#7CB342;border-radius:50%;margin-right:4px;vertical-align:middle;position:relative;top:-1px}

/* FAQ */
.flist{max-width:800px;margin:0 auto;display:flex;flex-direction:column;gap:1rem}
.fi{background:var(--white);border-radius:var(--r);overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);border:2px solid transparent;transition:all .3s}
.fi.op,.fi:hover{border-color:var(--yellow)}
.fq{padding:1.2rem 1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-family:'Lilita One',sans-serif;font-size:1.05rem;color:var(--black);border:none;background:none;width:100%;text-align:left}
.ftog{width:32px;height:32px;background:var(--yellow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:var(--black);flex-shrink:0;transition:transform .3s;margin-left:1rem;font-family:'Lilita One',sans-serif}
.ftog.op{transform:rotate(45deg)}
.fa{padding:0 1.4rem 1.2rem;color:var(--tm);font-size:.95rem;line-height:1.7;font-weight:600}

/* VISUAL STEPS (Preguntas) */
.vsgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;max-width:1000px;margin:0 auto}
.vs{background:var(--white);border-radius:var(--rl);padding:1.8rem 1.3rem;text-align:center;box-shadow:var(--sh);border-top:6px solid var(--yellow);transition:all .3s}
.vs:nth-child(2){border-top-color:var(--coral)}.vs:nth-child(3){border-top-color:var(--teal)}.vs:nth-child(4){border-top-color:var(--green)}.vs:nth-child(5){border-top-color:#B388FF}.vs:nth-child(6){border-top-color:#FFB74D}
.vs:hover{transform:translateY(-5px);box-shadow:var(--shl)}.vs h3{color:var(--black);font-size:1rem;margin:.7rem 0 .3rem}.vs p{color:var(--tm);font-size:.85rem;font-weight:600;line-height:1.4}

/* FORMS */
.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem}
.fg{display:flex;flex-direction:column}.fg.full{grid-column:1/-1}
.fg label{font-family:'Lilita One',sans-serif;color:var(--black);margin-bottom:.3rem;font-size:.9rem}
.fg input,.fg select,.fg textarea{padding:.75rem .9rem;border:3px solid var(--cream-dk);border-radius:12px;font-family:'Quicksand',sans-serif;font-size:1rem;font-weight:600;color:var(--text);transition:border-color .2s;background:var(--white)}
.fg input:focus,.fg select:focus,.fg textarea:focus{outline:none;border-color:var(--yellow);box-shadow:0 0 0 3px rgba(255,214,10,.2)}
.fg textarea{resize:vertical;min-height:90px}

/* ABOUT */
.acard{background:var(--white);border-radius:var(--rl);padding:2.5rem;box-shadow:var(--sh);max-width:800px;margin:0 auto 2rem;border-left:6px solid var(--yellow)}
.acard h3{color:var(--black);font-size:1.3rem;margin-bottom:.7rem}.acard p{color:var(--tm);line-height:1.7;font-size:1rem;font-weight:600}
.valgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;max-width:800px;margin:2rem auto 0}
.valc{text-align:center;padding:1.5rem;background:var(--white);border-radius:var(--r);box-shadow:var(--sh);border-bottom:4px solid var(--yellow);transition:transform .3s}
.valc:hover{transform:translateY(-4px)}.valc h4{color:var(--black);font-size:1.05rem;margin:.7rem 0 .3rem}.valc p{color:var(--tm);font-size:.85rem;font-weight:600}

/* CONTACT */
.cgrid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;max-width:1000px;margin:0 auto}@media(max-width:768px){.cgrid{grid-template-columns:1fr}}
.ci{background:var(--white);border-radius:var(--r);padding:1.1rem 1.3rem;display:flex;align-items:center;gap:1rem;box-shadow:0 2px 8px rgba(0,0,0,.05);margin-bottom:.8rem;transition:all .2s;border:2px solid transparent}
.ci:hover{border-color:var(--yellow)}.cib{width:44px;height:44px;background:var(--yellow);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ci h4{font-size:.8rem;color:var(--tl);font-weight:700}.ci p{color:var(--black);font-weight:700;font-size:.95rem}

/* FOOTER */
.ft{background:var(--black);color:#fff;padding:3rem 2rem 1.5rem}
.ftg{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2rem;max-width:1200px;margin:0 auto 2rem}
@media(max-width:768px){.ftg{grid-template-columns:1fr 1fr}}@media(max-width:480px){.ftg{grid-template-columns:1fr}}
.ft h4{font-family:'Lilita One',sans-serif;color:var(--yellow);margin-bottom:.8rem;font-size:1rem}
.ft p,.ft a{color:rgba(255,255,255,.6);font-size:.85rem;line-height:1.8;text-decoration:none;font-weight:600}.ft a:hover{color:var(--yellow)}
.ftbrand{font-family:'Lilita One',sans-serif;font-size:1.4rem;color:var(--yellow);margin-bottom:.5rem;display:flex;align-items:center;gap:10px}
.ftbot{border-top:1px solid rgba(255,255,255,.08);padding-top:1.5rem;text-align:center;color:rgba(255,255,255,.3);font-size:.8rem}


/* GAME BROWSER */
.jbrowser{display:grid;grid-template-columns:280px 1fr;gap:2rem;align-items:start}
@media(max-width:860px){.jbrowser{grid-template-columns:1fr}}
.jside{background:var(--white);border-radius:var(--rl);padding:1.5rem;box-shadow:var(--sh);position:sticky;top:88px}
.jside-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
.jside-head h3{font-family:'Lilita One',sans-serif;font-size:1.2rem;color:var(--black)}
.jreset{background:none;border:none;color:var(--coral);font-weight:700;font-size:.85rem;cursor:pointer;text-decoration:underline}
.jfield{margin-bottom:1.3rem}
.jfield label{display:block;font-family:'Lilita One',sans-serif;font-size:.9rem;color:var(--black);margin-bottom:.4rem}
.jfield input[type="text"]{width:100%;padding:.6rem .8rem;border:3px solid var(--cream-dk);border-radius:10px;font-family:'Quicksand',sans-serif;font-size:.9rem;font-weight:600;transition:border-color .2s}
.jfield input[type="text"]:focus{outline:none;border-color:var(--yellow);box-shadow:0 0 0 3px rgba(255,214,10,.2)}
.jfield input[type="range"]{width:100%;height:6px;-webkit-appearance:none;appearance:none;background:var(--cream-dk);border-radius:3px;outline:none;margin:.5rem 0}
.jfield input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--yellow);border:3px solid var(--black);cursor:pointer;box-shadow:var(--shh)}
.jrange-labels{display:flex;justify-content:space-between;font-size:.75rem;color:var(--tl);font-weight:600}
.jcount{background:var(--black);color:var(--yellow);padding:.7rem 1rem;border-radius:10px;text-align:center;font-family:'Lilita One',sans-serif;font-size:.95rem}

.jmain{min-width:0}
.jgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem}
@media(max-width:400px){.jgrid{grid-template-columns:1fr}}
.jcard{background:var(--white);border-radius:var(--r);overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);cursor:pointer;transition:all .3s;border:2px solid transparent;display:flex;flex-direction:column}
.jcard:hover{border-color:var(--yellow);box-shadow:var(--shl);transform:translateY(-4px)}
.jcard-body{padding:.8rem 1rem;flex:1}
.jcard-body h4{font-family:'Lilita One',sans-serif;font-size:.95rem;color:var(--black);margin-bottom:.3rem;line-height:1.2}
.jcard-diff{float:right;margin-left:.5rem}
.gdot{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(0,0,0,.1)}
.jcard-meta{display:flex;gap:.7rem;flex-wrap:wrap;margin-top:.3rem}
.jcard-meta span{font-size:.75rem;color:var(--tm);font-weight:700;display:flex;align-items:center;gap:2px}
.jcard-cta{background:var(--teal);color:#fff;text-align:center;padding:.5rem;font-family:'Lilita One',sans-serif;font-size:.85rem;transition:background .2s}
.jcard:hover .jcard-cta{background:var(--teal-dk)}

.jpag{display:flex;justify-content:center;align-items:center;gap:1.5rem;margin-top:2rem;padding-top:1.5rem;border-top:2px solid var(--cream-dk)}
.jpag-btn{padding:.5rem 1.2rem;border-radius:10px;border:3px solid var(--black);background:var(--white);font-family:'Lilita One',sans-serif;font-size:.9rem;cursor:pointer;transition:all .2s;color:var(--black)}
.jpag-btn:hover:not(:disabled){background:var(--black);color:var(--yellow)}
.jpag-btn:disabled{opacity:.3;cursor:default}
.jpag-info{font-weight:700;color:var(--tm);font-size:.9rem}

/* GAME MODAL */
.gmodal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)}
.gmodal{background:var(--white);border-radius:var(--rl);max-width:800px;width:100%;max-height:90vh;overflow-y:auto;position:relative;box-shadow:var(--shl);animation:modalIn .3s ease}
@keyframes modalIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
.gmodal-close{position:absolute;top:1rem;right:1rem;width:36px;height:36px;background:var(--black);color:var(--yellow);border:none;border-radius:50%;font-size:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;font-family:'Lilita One',sans-serif;box-shadow:var(--shh);transition:transform .2s}
.gmodal-close:hover{transform:scale(1.1)}
.gmodal-grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
@media(max-width:600px){.gmodal-grid{grid-template-columns:1fr}}
.gmodal-img{padding:1.5rem}
.gmodal-info{padding:1.5rem 1.5rem 1.5rem 0}
@media(max-width:600px){.gmodal-info{padding:0 1.5rem 1.5rem}}
.gmodal-info h2{font-family:'Lilita One',sans-serif;font-size:1.5rem;color:var(--black);margin-bottom:.5rem;line-height:1.2}
.gmodal-diff{display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;font-size:.9rem;font-weight:700;color:var(--tm)}
.gmodal-stats{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:1rem}
.gstat{display:flex;align-items:center;gap:.5rem;background:var(--cream);padding:.6rem .8rem;border-radius:10px}
.gstat small{display:block;font-size:.7rem;color:var(--tl);font-weight:600}
.gstat strong{display:block;font-size:.9rem;color:var(--black)}
.gmodal-desc{color:var(--tm);font-size:.9rem;line-height:1.6;font-weight:600;margin-bottom:1rem}
.gmodal-tab-btns{display:flex;gap:.4rem;margin-bottom:.75rem;border-bottom:2px solid var(--cream);padding-bottom:.4rem}
.gmodal-tab-btn{background:none;border:none;padding:.35rem .8rem;font-family:'Lilita One',sans-serif;font-size:.82rem;color:var(--tm);cursor:pointer;border-radius:6px 6px 0 0;transition:all .15s}
.gmodal-tab-btn:hover{background:var(--cream)}
.gmodal-tab-btn.active{color:var(--black);background:var(--yellow);font-weight:700}
.gmodal-tab-content{min-height:3rem}
.gmodal-tags{display:flex;gap:.4rem;flex-wrap:wrap}
.gtag{padding:.2rem .7rem;border-radius:50px;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.gtag.green{background:#E8F5E9;color:#2E7D32}.gtag.red{background:#FFEBEE;color:#C62828}
.gtag.blue{background:#E3F2FD;color:#1565C0}.gtag.purple{background:#F3E5F5;color:#7B1FA2}
.gtag.orange{background:#FFF3E0;color:#E65100}.gtag.dark{background:#ECEFF1;color:#37474F}


/* GAME TYPE FILTER BUTTONS */
.jtype-grid{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.3rem}
.jtype-btn{padding:.3rem .7rem;border-radius:8px;border:2px solid var(--cream-dk);background:var(--white);font-size:.78rem;font-weight:700;cursor:pointer;transition:all .2s;color:var(--tm)}
.jtype-btn:hover{border-color:var(--yellow)}
.jtype-btn.on{background:var(--yellow);border-color:var(--yellow);color:var(--black)}

/* MODAL TAG ROWS */
.gmodal-tagrow{display:flex;flex-wrap:wrap;align-items:center;gap:.3rem;margin-bottom:.6rem}
.gmodal-taglabel{font-family:'Lilita One',sans-serif;font-size:.8rem;color:var(--tm);margin-right:.3rem}
.gtag{padding:.15rem .55rem;border-radius:6px;font-size:.72rem;font-weight:700;display:inline-block}
.gtag.tipo{background:#1A1A2E;color:var(--yellow)}
.gtag.cat{background:var(--teal);color:#fff}
.gtag.mech{background:var(--cream-dk);color:var(--char);border:1px solid #ddd}

/* RESERVATION SYSTEM */
.res-steps{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:2.5rem;padding:0 1rem}
.res-step{display:flex;flex-direction:column;align-items:center;gap:.3rem;opacity:.4;transition:all .3s}
.res-step.active{opacity:1}
.rs-num{width:40px;height:40px;background:var(--cream-dk);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Lilita One',sans-serif;font-size:1.1rem;color:var(--tm);border:3px solid var(--cream-dk);transition:all .3s}
.res-step.active .rs-num{background:var(--yellow);color:var(--black);border-color:var(--black)}
.res-step span{font-size:.8rem;font-weight:700;color:var(--tm)}
.rs-line{width:60px;height:3px;background:var(--cream-dk);margin:0 .5rem;margin-bottom:1.2rem}
.res-card{background:var(--white);border-radius:var(--rl);padding:2.5rem;box-shadow:var(--sh);max-width:960px;margin:0 auto;border-top:6px solid var(--yellow)}
.res-card-title{font-family:'Lilita One',sans-serif;color:var(--black);font-size:1.4rem;text-align:center;margin-bottom:.3rem}
.res-card-sub{text-align:center;color:var(--tm);font-weight:600;margin-bottom:2rem;font-size:.9rem}
.res-mock-notice{display:flex;align-items:center;gap:.6rem;background:#FFF3E0;border:2px solid #FFB74D;border-radius:12px;padding:.7rem 1.2rem;margin-bottom:1.5rem;font-size:.88rem;font-weight:600;color:#E65100}
.res-selectors{display:grid;grid-template-columns:repeat(4,1fr);gap:1.2rem;margin-bottom:1.5rem}
@media(max-width:900px){.res-selectors{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.res-selectors{grid-template-columns:1fr}}

/* HOUR GRID */
.hour-grid{margin-bottom:1.5rem}
.hg-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:.5rem}
.hg-slot{padding:.6rem .5rem;border:3px solid var(--cream-dk);border-radius:12px;background:var(--white);cursor:pointer;text-align:center;transition:all .2s}
.hg-slot:hover{border-color:var(--yellow)}
.hg-slot.sel{border-color:var(--black);background:var(--yellow-lt);box-shadow:var(--shh)}
.hg-time{font-family:'Lilita One',sans-serif;font-size:1rem;color:var(--black);display:block}
.hg-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-top:.2rem}
.hg-dot.free{background:#7CB342}.hg-dot.combine{background:#2196F3}.hg-dot.warn{background:#FF9800}.hg-dot.full{background:#FF6B6B}.hg-dot.neutral{background:#ccc}
.hg-legend{display:flex;gap:1rem;margin-top:.7rem;font-size:.75rem;font-weight:600;color:var(--tm);flex-wrap:wrap}
.hg-legend span{display:flex;align-items:center;gap:.3rem}

/* FLOOR PLAN 2D */
.fp2-wrapper{margin-top:1.5rem;background:#2D2D44;border-radius:var(--rl);padding:1.5rem;border:3px solid var(--char)}
.fp2-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem}
.fp2-header h4{font-family:'Lilita One',sans-serif;font-size:1.1rem;color:var(--yellow)}
.fp2-legend{display:flex;gap:.7rem;font-size:.7rem;font-weight:700;color:rgba(255,255,255,.7);flex-wrap:wrap}
.fp2-legend span{display:flex;align-items:center;gap:.3rem}
.fp2-ldot{width:12px;height:12px;border-radius:3px;border:2px solid}

.fp2-scroll{overflow-x:auto;overflow-y:visible;padding-bottom:.5rem}
.fp2-map{position:relative;margin:0 auto;min-height:300px}
.fp2-grid-bg{position:absolute;inset:0;opacity:.06;background-image:url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40' fill='none' stroke='%23fff' stroke-width='.5'/%3E%3C/svg%3E");background-size:40px;border-radius:8px}

/* Furniture */
.fp2-furniture{position:absolute;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:6px;z-index:1}
.fp2-bar{background:#5D4037;color:#FFCC80;border:2px solid #8D6E63}
.fp2-shelf{background:#37474F;color:#B0BEC5;border:2px solid #546E7A}
.fp2-door{background:var(--yellow);color:var(--black);font-family:'Lilita One',sans-serif;font-size:.8rem;border:2px solid var(--yellow-dk)}
.fp2-kitchen{background:#424242;color:#BDBDBD;border:2px solid #616161}
.fp2-plant{background:#2E7D32;color:#fff;border-radius:50%;border:2px solid #388E3C;font-size:1.2rem}

/* Tables - absolutely positioned */
.fp2-table{position:absolute;border:3px solid;display:flex;align-items:center;justify-content:center;z-index:5;transition:all .25s;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.fp2-table:hover:not(.fp2-t-occ){transform:scale(1.06);z-index:10;box-shadow:0 4px 16px rgba(0,0,0,.4)}
.fp2-tlabel{text-align:center;pointer-events:none;position:relative;z-index:2}
.fp2-tid{font-family:'Lilita One',sans-serif;font-size:.75rem;line-height:1}
.fp2-tseats{font-size:.6rem;font-weight:700;margin-top:1px}

/* Chairs - absolutely positioned around table */
.fp2-chair{position:absolute;width:12px;height:12px;border-radius:50%;border:2px solid;z-index:3;transition:all .25s}

/* Reserved badge */
.fp2-reserved{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#C62828;color:#fff;font-size:.5rem;font-weight:800;padding:1px 6px;border-radius:6px;white-space:nowrap;letter-spacing:.5px;z-index:6}

/* Combine tag */
.fp2-combine-tag{position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);background:#1565C0;color:#fff;font-size:.5rem;font-weight:800;padding:1px 6px;border-radius:6px;white-space:nowrap;letter-spacing:.5px;z-index:6;animation:blink-cmb 1.5s infinite}
@keyframes blink-cmb{0%,100%{opacity:1}50%{opacity:.5}}

/* Check mark for selected */
.fp2-check{position:absolute;top:-8px;right:-8px;width:20px;height:20px;background:var(--yellow);border:2px solid var(--black);border-radius:50%;font-size:.65rem;display:flex;align-items:center;justify-content:center;z-index:6;font-weight:900;color:var(--black)}

/* Combinable animation */
.fp2-t-cmb{border-style:dashed;animation:pulse-cmb 1.8s ease infinite}
@keyframes pulse-cmb{0%,100%{box-shadow:0 0 0 3px rgba(66,165,245,.3)}50%{box-shadow:0 0 0 8px rgba(66,165,245,.1)}}

/* Selection glow */
.fp2-t-sel{box-shadow:0 0 0 4px rgba(255,214,10,.5),0 4px 16px rgba(0,0,0,.3)}

/* Summary below map */
.fp2-summary{display:flex;align-items:center;gap:.7rem;padding:1rem;border-radius:12px;margin-top:1rem}
.fp2-ok{background:#E8F5E9;border:2px solid #A5D6A7}
.fp2-need{background:#FFF3E0;border:2px solid #FFB74D}
.fp2-summary strong{display:block;font-family:'Lilita One',sans-serif;font-size:.9rem;color:var(--black)}
.fp2-summary span{display:block;font-size:.8rem;font-weight:600;color:var(--tm);margin-top:.1rem}

/* SPECIAL REQUEST */
.av-special{display:flex;align-items:center;gap:1rem;background:var(--yellow-lt);border:2px solid var(--yellow);border-radius:14px;padding:1.2rem 1.5rem;margin-top:1rem}
.av-special-icon{flex-shrink:0}
.av-special-text{flex:1}
.av-special-text strong{display:block;font-family:'Lilita One',sans-serif;font-size:.95rem;color:var(--black);margin-bottom:.2rem}
.av-special-text p{font-size:.85rem;font-weight:600;color:var(--tm);line-height:1.4;margin:0}
@media(max-width:600px){.av-special{flex-direction:column;text-align:center}}

/* av-msg used in special request confirmation */
.av-msg{display:flex;align-items:flex-start;gap:.8rem;padding:1rem;border-radius:12px}
.av-no{background:#FFF3E0;border:2px solid #FFB74D}
.av-msg strong{display:block;font-family:'Lilita One',sans-serif;font-size:.95rem;color:var(--black)}
.av-msg span{display:block;font-size:.85rem;font-weight:600;color:var(--tm);margin-top:.15rem}

.special-form{background:var(--yellow-lt);border:3px solid var(--yellow);border-radius:var(--rl);padding:2rem;margin-top:1.5rem;animation:slideDown .3s ease}
@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
.special-form-head{text-align:center;margin-bottom:1.5rem}
.special-form-head h3{font-family:'Lilita One',sans-serif;color:var(--black);font-size:1.2rem;margin-bottom:.3rem}
.special-form-head p{color:var(--tm);font-size:.9rem;font-weight:600;max-width:500px;margin:0 auto}

/* CONFIRMATION SUMMARY */
.res-summary{text-align:left;max-width:400px;margin:0 auto;background:var(--cream);border-radius:12px;padding:1rem 1.5rem}
.res-row{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--cream-dk);font-size:.9rem}
.res-row:last-child{border:none}
.res-row strong{color:var(--tm);font-weight:700}
.res-row span{color:var(--black);font-weight:700}

/* EXPERIENCE IMAGE PLACEHOLDER */
.exp-img-placeholder{max-width:900px;margin:0 auto;background:var(--white);border-radius:var(--rl);box-shadow:var(--sh);overflow:hidden;border:3px dashed var(--yellow)}
.exp-img-inner{padding:4rem 2rem;text-align:center;color:var(--tm)}
.exp-img-inner p{font-family:'Lilita One',sans-serif;font-size:1.2rem;color:var(--black);margin:.8rem 0 .3rem}
.exp-img-inner span{font-size:.9rem;font-weight:600;color:var(--tl)}


/* AUTH MODAL */
.auth-modal{background:var(--white);border-radius:var(--rl);padding:2.5rem;max-width:420px;width:100%;position:relative;box-shadow:var(--shl);animation:modalIn .3s ease}

/* DEXTER CHATBOT */
.dexter-fab{position:fixed;bottom:2rem;left:2rem;width:56px;height:56px;border-radius:50%;background:var(--black);border:3px solid var(--yellow);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:var(--shl);z-index:998;transition:all .3s;animation:dexter-bounce 3s ease infinite}
.dexter-fab:hover{transform:scale(1.1)}
@keyframes dexter-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.dexter-panel{position:fixed;bottom:2rem;left:2rem;width:380px;max-width:calc(100vw - 2rem);height:520px;max-height:calc(100vh - 4rem);background:var(--white);border-radius:var(--rl);box-shadow:var(--shl);z-index:998;display:flex;flex-direction:column;overflow:hidden;border:3px solid var(--black);animation:modalIn .3s ease}
@media(max-width:500px){.dexter-panel{width:calc(100vw - 2rem);height:calc(100vh - 6rem);bottom:1rem;left:1rem}}
.dexter-header{background:var(--black);padding:.8rem 1rem;display:flex;justify-content:space-between;align-items:center}
.dexter-messages{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem;background:var(--cream)}
.dexter-msg{display:flex;gap:.5rem;max-width:85%}.dexter-assistant{align-self:flex-start}.dexter-user{align-self:flex-end;flex-direction:row-reverse}
.dexter-avatar{width:28px;height:28px;border-radius:50%;background:var(--black);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dexter-bubble{padding:.6rem .9rem;border-radius:14px;font-size:.88rem;font-weight:600;line-height:1.5;white-space:pre-wrap}
.dexter-assistant .dexter-bubble{background:var(--white);color:var(--text);border:2px solid var(--cream-dk);border-top-left-radius:4px}
.dexter-user .dexter-bubble{background:var(--yellow);color:var(--black);border-top-right-radius:4px}
.dexter-typing span{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--tm);margin:0 2px;animation:typing .8s ease infinite}.dexter-typing span:nth-child(2){animation-delay:.15s}.dexter-typing span:nth-child(3){animation-delay:.3s}
@keyframes typing{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
.dexter-quick{display:flex;flex-wrap:wrap;gap:.4rem;padding:.5rem 0}
.dexter-quick button{padding:.3rem .7rem;border-radius:50px;border:2px solid var(--yellow);background:var(--white);font-size:.75rem;font-weight:700;cursor:pointer;color:var(--black);transition:all .2s}.dexter-quick button:hover{background:var(--yellow)}
.dexter-input{display:flex;gap:.5rem;padding:.8rem;border-top:2px solid var(--cream-dk);background:var(--white)}
.dexter-input input{flex:1;padding:.5rem .8rem;border:2px solid var(--cream-dk);border-radius:10px;font-family:'Quicksand',sans-serif;font-weight:600;font-size:.9rem}.dexter-input input:focus{outline:none;border-color:var(--yellow)}
.dexter-input button{width:36px;height:36px;border-radius:50%;background:var(--yellow);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--black);transition:all .2s}.dexter-input button:disabled{opacity:.3}

/* SCROLL TOP */
.sctop{position:fixed;bottom:2rem;right:2rem;width:48px;height:48px;background:var(--yellow);color:var(--black);border:3px solid var(--black);border-radius:50%;font-size:1.3rem;font-family:'Lilita One',sans-serif;cursor:pointer;box-shadow:var(--shh);display:flex;align-items:center;justify-content:center;z-index:999;transition:all .3s;opacity:0;pointer-events:none}
.sctop.vis{opacity:1;pointer-events:auto}.sctop:hover{transform:translateY(-3px)}
`;

// ============================================================
// NAV & FOOTER
// ============================================================

// ============================================================
// LOGIN / REGISTER MODAL
// ============================================================
function AuthModal({ onClose, onAuth, initialMode }) {
  const [mode, setMode] = useState(initialMode || "login");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "login") await onAuth.login(form.email, form.password);
      else {
        if (!form.name) { setError("El nombre es obligatorio"); setLoading(false); return; }
        if (form.password.length < 6) { setError("Mínimo 6 caracteres"); setLoading(false); return; }
        await onAuth.register(form.email, form.password, form.name, form.phone);
      }
      onClose();
    } catch (e) { setError(e.message || "Error"); } finally { setLoading(false); }
  };
  return (
    <div className="gmodal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="gmodal-close" onClick={onClose}>×</button>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          {I.dice(48, "#FFD60A")}
          <h2 style={{ fontFamily: "'Lilita One',sans-serif", color: "var(--black)", fontSize: "1.5rem", marginTop: ".5rem" }}>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
          <p style={{ color: "var(--tm)", fontWeight: 600, fontSize: ".9rem" }}>{mode === "login" ? "Accede para gestionar tus reservas" : "Regístrate para reservar fácilmente"}</p>
        </div>
        {error && <div style={{ background: "#FFEBEE", border: "2px solid #EF9A9A", borderRadius: 10, padding: ".6rem 1rem", marginBottom: "1rem", color: "#C62828", fontWeight: 600, fontSize: ".85rem" }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
          {mode === "register" && <div className="fg"><label>Nombre *</label><input placeholder="Tu nombre" value={form.name} onChange={e => set("name", e.target.value)} /></div>}
          <div className="fg"><label>Email *</label><input type="email" placeholder="tu@email.com" value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div className="fg"><label>Contraseña *</label><input type="password" placeholder={mode === "login" ? "Tu contraseña" : "Mínimo 6 caracteres"} value={form.password} onChange={e => set("password", e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} /></div>
          {mode === "register" && <div className="fg"><label>Teléfono</label><input placeholder="600 123 456" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>}
        </div>
        <button className="btn btn-yellow" disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: "1.2rem", fontSize: "1.05rem" }} onClick={handleSubmit}>{loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
        <p style={{ textAlign: "center", marginTop: "1rem", fontSize: ".85rem", fontWeight: 600, color: "var(--tm)" }}>
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ background: "none", border: "none", color: "var(--teal)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{mode === "login" ? "Regístrate" : "Inicia sesión"}</button>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// MI CUENTA PAGE
// ============================================================
function PMiCuenta({ auth, setPage }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  useEffect(() => { api.customer.reservations().then(data => { if (data) setReservations(data); }).finally(() => setLoading(false)); }, []);
  const now = new Date(); now.setHours(0,0,0,0);
  const upcoming = reservations.filter(r => new Date(r.date) >= now && r.status !== "CANCELLED");
  const past = reservations.filter(r => new Date(r.date) < now || r.status === "CANCELLED");
  const handleCancel = async (r) => { if (!confirm("¿Seguro que quieres cancelar esta reserva?")) return; const result = await api.reservations.cancel(r.cancelToken, auth.user.email); if (result) setReservations(prev => prev.map(res => res.id === r.id ? { ...res, status: "CANCELLED" } : res)); };
  const handleRebook = (r) => { setPage("reservas"); window.scrollTo(0, 0); if (r.rebookData) sessionStorage.setItem("elbunker_rebook", JSON.stringify({ zone: r.rebookData.zoneSlug, people: r.rebookData.people, eventType: r.rebookData.eventType })); };
  const statusLabels = { CONFIRMED: "Confirmada", PENDING: "Pendiente", CANCELLED: "Cancelada", COMPLETED: "Completada", REJECTED: "Rechazada", NO_SHOW: "No presentado" };
  const statusColors = { CONFIRMED: "#7CB342", PENDING: "#FF9800", CANCELLED: "#9E9E9E", COMPLETED: "#0096B7", REJECTED: "#C62828", NO_SHOW: "#795548" };
  return (<>
    <div className="ph"><h1>Mi Cuenta</h1><p>Hola, {auth.user?.name}</p></div>
    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn" style={{ maxWidth: 800 }}>
        <div style={{ background: "var(--white)", borderRadius: "var(--rl)", padding: "1.5rem 2rem", boxShadow: "var(--sh)", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center" }}>{I.people(32, "#1A1A2E")}</div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "'Lilita One',sans-serif", fontSize: "1.2rem", color: "var(--black)" }}>{auth.user?.name}</div><div style={{ color: "var(--tm)", fontWeight: 600, fontSize: ".9rem" }}>{auth.user?.email}</div>{auth.user?.phone && <div style={{ color: "var(--tl)", fontWeight: 600, fontSize: ".85rem" }}>{auth.user.phone}</div>}</div>
          <button className="btn btn-sm btn-dark" onClick={auth.logout}>Cerrar sesión</button>
        </div>
        <div style={{ display: "flex", gap: ".5rem", marginBottom: "1.5rem" }}>
          <button className={`fbtn ${tab === "upcoming" ? "on" : ""}`} onClick={() => setTab("upcoming")}>Próximas ({upcoming.length})</button>
          <button className={`fbtn ${tab === "past" ? "on" : ""}`} onClick={() => setTab("past")}>Historial ({past.length})</button>
        </div>
        {loading && <p style={{ textAlign: "center", padding: "2rem", color: "var(--tm)" }}>Cargando reservas...</p>}
        {!loading && (tab === "upcoming" ? upcoming : past).length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", background: "var(--white)", borderRadius: "var(--rl)", boxShadow: "var(--sh)" }}>
            {I.dice(56, "#ccc")}
            <p style={{ fontFamily: "'Lilita One',sans-serif", color: "var(--tm)", marginTop: "1rem" }}>{tab === "upcoming" ? "No tienes reservas próximas" : "No hay reservas en tu historial"}</p>
            {tab === "upcoming" && <button className="btn btn-yellow btn-sm" style={{ marginTop: "1rem" }} onClick={() => { setPage("reservas"); window.scrollTo(0, 0); }}>Hacer una reserva</button>}
          </div>
        )}
        {(tab === "upcoming" ? upcoming : past).map(r => (
          <div key={r.id} style={{ background: "var(--white)", borderRadius: "var(--r)", padding: "1.2rem 1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,.05)", marginBottom: ".8rem", borderLeft: "5px solid " + (statusColors[r.status] || "#ccc") }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: ".5rem" }}>
              <div>
                <div style={{ fontFamily: "'Lilita One',sans-serif", fontSize: "1.05rem", color: "var(--black)" }}>{new Date(r.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })} · {r.hour}</div>
                <div style={{ color: "var(--tm)", fontWeight: 600, fontSize: ".85rem", marginTop: ".2rem" }}>{r.tables?.map(t => t.label).join(" + ")} · {r.tables?.[0]?.zone} · {r.people} personas</div>
              </div>
              <span style={{ background: (statusColors[r.status] || "#ccc") + "22", color: statusColors[r.status], padding: ".2rem .6rem", borderRadius: 8, fontWeight: 700, fontSize: ".75rem" }}>{statusLabels[r.status] || r.status}</span>
            </div>
            {r.status === "CONFIRMED" && tab === "upcoming" && <div style={{ marginTop: ".8rem" }}><button className="btn btn-sm btn-dark" style={{ fontSize: ".8rem" }} onClick={() => handleCancel(r)}>Cancelar</button></div>}
            {tab === "past" && r.status !== "CANCELLED" && <div style={{ marginTop: ".8rem" }}><button className="btn btn-sm btn-yellow" style={{ fontSize: ".8rem" }} onClick={() => handleRebook(r)}>Repetir reserva</button></div>}
          </div>
        ))}
      </div>
    </section>
  </>);
}

// ============================================================
// DEXTER CHATBOT
// ============================================================
function DexterChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: "¡Hola! Soy Dexter, el asistente de El Búnker. ¿En qué puedo ayudarte? Puedo resolver dudas sobre el local, la carta, los juegos, cómo reservar..." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [gameCard, setGameCard] = useState(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const quickOptions = [{ label: "¿Cómo funciona?", msg: "¿Cómo funciona El Búnker?" }, { label: "Ver la carta", msg: "¿Qué tenéis para comer?" }, { label: "Juegos para 4", msg: "¿Qué juegos me recomiendas para 4 personas principiantes?" }, { label: "Reservar", msg: "¿Cómo puedo reservar?" }, { label: "Precios", msg: "¿Cuánto cuesta jugar?" }, { label: "Cumpleaños", msg: "¿Puedo celebrar un cumpleaños?" }];
  const sendMsg = async (msg) => {
    if (!msg.trim() || loading) return;
    setMessages(prev => [...prev, { role: "user", content: msg.trim() }]);
    setInput(""); setLoading(true);
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const result = await api.chat(msg.trim(), history);
    const gamesData = result?.games ?? null;
    const qr = result?.quickReplies ?? null;
    setMessages(prev => [...prev, { role: "assistant", content: result?.reply || "Lo siento, no puedo responder ahora. Contacta con nosotros en hola@elbunker.es.", games: gamesData, quickReplies: qr }]);
    setLoading(false);
  };
  if (!open) return (<button className="dexter-fab" onClick={() => setOpen(true)} title="Habla con Dexter"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 2C7.4 2 2 6.6 2 12.2c0 3.2 1.7 6.1 4.4 8L5 25l5.6-2.8c1.1.3 2.2.4 3.4.4 6.6 0 12-4.6 12-10.2S20.6 2 14 2z" fill="#FFD60A"/><circle cx="9" cy="12" r="1.5" fill="#1A1A2E"/><circle cx="14" cy="12" r="1.5" fill="#1A1A2E"/><circle cx="19" cy="12" r="1.5" fill="#1A1A2E"/></svg></button>);
  return (
    <>
    <GameModal game={gameCard} onClose={() => setGameCard(null)} />
    <div className="dexter-panel">
      <div className="dexter-header">
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>{I.dice(28, "#FFD60A")}<div><div style={{ fontFamily: "'Lilita One',sans-serif", fontSize: "1rem", color: "var(--yellow)" }}>Dexter</div><div style={{ fontSize: ".7rem", color: "rgba(255,255,255,.6)", fontWeight: 600 }}>Asistente de El Búnker</div></div></div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: "1.3rem", cursor: "pointer" }}>×</button>
      </div>
      <div className="dexter-messages">
        {messages.map((m, i) => {
          const isLastAssistant = m.role === "assistant" && i === messages.map((x, xi) => x.role === "assistant" ? xi : -1).filter(x => x >= 0).pop();
          return (<div key={i} className={"dexter-msg dexter-" + m.role}>{m.role === "assistant" && <div className="dexter-avatar">{I.dice(18, "#FFD60A")}</div>}<div className="dexter-bubble">{m.content}{m.games?.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: ".3rem", marginTop: ".6rem" }}>{m.games.map((g, gi) => <button key={gi} onClick={() => setGameCard(g)} style={{ background: "var(--yellow)", color: "#1A1A2E", border: "none", borderRadius: "8px", padding: ".35rem .8rem", fontWeight: 700, fontSize: ".8rem", cursor: "pointer", textAlign: "left" }}>🎲 {g.name}</button>)}</div>}{isLastAssistant && m.quickReplies?.length > 0 && <div className="dexter-quick" style={{ marginTop: ".6rem" }}>{m.quickReplies.map((qr, qi) => <button key={qi} onClick={() => sendMsg(qr)}>{qr}</button>)}</div>}</div></div>);
        })}
        {loading && <div className="dexter-msg dexter-assistant"><div className="dexter-avatar">{I.dice(18, "#FFD60A")}</div><div className="dexter-bubble dexter-typing"><span/><span/><span/></div></div>}
        <div ref={bottomRef} />
        {messages.length <= 1 && <div className="dexter-quick">{quickOptions.map((q, i) => <button key={i} onClick={() => sendMsg(q.msg)}>{q.label}</button>)}</div>}
      </div>
      <div className="dexter-input">
        <input placeholder="Escribe tu pregunta..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg(input)} disabled={loading} />
        <button onClick={() => sendMsg(input)} disabled={loading || !input.trim()}><svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 10l16-8-4 8 4 8z" fill="currentColor"/></svg></button>
      </div>
    </div>
    </>
  );
}


function Nav({ page, setPage, auth, onLogin }) {
  const [open, setOpen] = useState(false);
  const go = p => { setPage(p); setOpen(false); window.scrollTo(0, 0); };
  return (
    <nav className="nav">
      <div className="nav-logo" onClick={() => go("inicio")}>
        <LogoMascot size={42} />
        <span className="nav-brand">El Búnker</span>
      </div>
      <button className="hmb" onClick={() => setOpen(!open)}><svg width="28" height="28" viewBox="0 0 28 28"><rect y="4" width="28" height="3" rx="1.5" fill="#fff" /><rect y="12" width="28" height="3" rx="1.5" fill="#FFD60A" /><rect y="20" width="28" height="3" rx="1.5" fill="#fff" /></svg></button>
      <div className={`nlinks ${open ? "open" : ""}`}>
        {[["inicio", "Inicio"], ["juegos", "Juegos"], ["carta", "Carta"], ["preguntas", "Preguntas"], ["nosotros", "Nosotros"], ["contacto", "Contacto"]].map(([k, l]) => <button key={k} className={`nl ${page === k ? "on" : ""}`} onClick={() => go(k)}>{l}</button>)}
        {auth && auth.isLoggedIn ? (
          <button className={"nl" + (page === "cuenta" ? " on" : "")} onClick={() => go("cuenta")} style={{ color: "var(--yellow)" }}>Mi Cuenta</button>
        ) : (
          <button className="nl" onClick={onLogin} style={{ color: "var(--yellow)" }}>Entrar</button>
        )}
        <button className="nl ncta" onClick={() => go("reservas")}>¡Reservar!</button>
      </div>
    </nav>
  );
}

function Foot({ setPage }) {
  const go = p => { setPage(p); window.scrollTo(0, 0); };
  return (
    <footer className="ft">
      <div className="ftg">
        <div><div className="ftbrand"><LogoMascot size={36} /> El Búnker</div><p>Tu board game café en Madrid. Juegos de mesa, comida de verdad, risas y buen rollo.</p></div>
        <div><h4>Navegar</h4>{["inicio", "juegos", "carta", "preguntas", "reservas", "contacto"].map(p => <div key={p}><a href="#" onClick={e => { e.preventDefault(); go(p) }}>{p.charAt(0).toUpperCase() + p.slice(1)}</a></div>)}</div>
        <div><h4>Horario</h4><p>Lun–Jue: 17:00–23:00<br />Vie: 17:00–00:00<br />Sáb: 12:00–00:00<br />Dom: 12:00–22:00</p></div>
        <div><h4>Contacto</h4><p>Calle Ejemplo, 42<br />28001 Madrid<br />912 345 678<br />hola@elbunker.es</p></div>
      </div>
      <div className="ftbot">© 2026 El Búnker Board Game Café · Hecho con dados y cariño</div>
    </footer>
  );
}

// ============================================================
// PAGES
// ============================================================
function PInicio({ setPage }) {
  const go = p => { setPage(p); window.scrollTo(0, 0); };
  return (<>
    <HeroCarousel setPage={setPage} />
    <div className="stripe"><span>{I.map(14, "#1A1A2E")} Madrid</span><span>{I.clock(14, "#1A1A2E")} Lun–Dom</span><span>{I.dice(14, "#1A1A2E")} +500 juegos</span><span>{I.coffee(14, "#1A1A2E")} Café & Restaurante</span><span>{I.people(14, "#1A1A2E")} Family Friendly</span></div>

    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn">
        <h2 className="stitle">¡Así <span className="yl">funciona</span>!</h2>
        <p className="ssub">Es muy fácil: ven, pide algo rico, elige tu juego y a disfrutar.</p>
        <Roadmap />
      </div>
    </section>

    <section className="statb"><h2>Más de <span className="big">500</span> Juegos</h2><p>Estrategia, party, cooperativos, familiares, para dos... ¡Los que quieras!</p><div style={{ marginTop: "1.5rem" }}><button className="btn btn-yellow" onClick={() => go("juegos")}>Descubre la colección</button></div></section>

    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn">
        <h2 className="stitle">En El Búnker <span className="yl">podrás...</span></h2>
        <p className="ssub">Tres experiencias en un solo lugar</p>
        <div className="pgrid">
          <div className="pcard"><MockImg label="Amigos disfrutando de una partida" grad="cool" h={190} round={false} /><div className="pbody"><h3>Jugar</h3><h4>+500 juegos de mesa para todos</h4><p>Desde clásicos hasta novedades. Para amigos, familia, pareja... Cada partida será inolvidable.</p><button className="btn btn-sm btn-dark" onClick={() => go("juegos")}>Ver juegos</button></div></div>
          <div className="pcard"><MockImg label="Crazy Nachos, Burgers, Hotdogs..." grad="warm" h={190} round={false} /><div className="pbody"><h3>Comer & Beber</h3><h4>Carta con personalidad propia</h4><p>Nachos, burgers, hotdogs, Bunker Cola, postres épicos... Combustible premium para tus partidas.</p><button className="btn btn-sm btn-dark" onClick={() => go("carta")}>Ver carta</button></div></div>
          <div className="pcard"><MockImg label="Cumpleaños y eventos especiales" grad="coral" h={190} round={false} /><div className="pbody"><h3>Celebrar</h3><h4>Cumples, afterworks y eventos</h4><p>¿Buscas un plan diferente? Celebra en El Búnker. Montamos el planazo completo.</p><button className="btn btn-sm btn-dark" onClick={() => go("contacto")}>Contáctanos</button></div></div>
        </div>
      </div>
    </section>

    <section className="sec"><div className="visit"><div style={{ flex: 1 }}><h2>¡Visítanos en Madrid!</h2><p>Calle Ejemplo, 42 · 28001 Madrid<br />Metro: Sol · Línea 1, 2, 3</p><button className="btn btn-yellow" onClick={() => go("contacto")}>Cómo llegar</button></div><div className="vmap">{I.map(64, "rgba(255,255,255,.4)")}</div></div></section>
  </>);
}


// Game data: [id, name, playersMin, playersMax, playersBest, durMin, durMax, difficulty, ageMin]
// Game data: [id, name, pMin, pMax, pBest, dMin, dMax, diff, ageMin, typeIds, catIds, mechIds]
const GDATA = [[1,"Pandemic Legacy: Season 1",2,4,4,60,60,3,13,"1","27,43","3,40,62,80,118,140,163,175"],[2,"Terraforming Mars",1,5,3,120,120,3,12,"1","24,27,37,69,70,73","51,54,62,63,71,140,146,155,160,170,175"],[3,"Through the Ages: A New Story of Civilization",2,4,3,120,120,5,14,"1","15,19,24","3,13,15,28,55,71,155"],[4,"Twilight Struggle",2,2,2,120,180,4,13,"4","47,60,80","7,8,10,27,48,55,62,141,142,154,166"],[5,"Los castillos de Borgoña",2,4,2,30,90,3,12,"1,3","23,44,73","48,60,63,140,160,173,180"],[6,"7 Wonders Duel",2,2,2,30,30,2,10,"1","9,15,17,19,24","28,79,140,154,166"],[7,"Terra Mystica",2,5,4,60,150,4,12,"1","19,24,31,73","54,63,71,72,104,158,169,175,176,177"],[8,"Puerto Rico",3,5,4,90,150,3,12,"1","17,24,32","2,54,58,66,72,170,174"],[9,"Agricola",1,5,3,30,150,4,12,"1","10,24,32","8,22,51,53,62,72,146,168,175,179"],[10,"La Tripulación",2,5,4,20,20,2,10,"3,5,1","15,69,70","36,40,62,135,165"],[11,"Tzolk'in: The Mayan Calendar",2,4,4,90,90,4,13,"1","9,19,24,32,51","24,54,168,179"],[12,"Alta tensión",2,6,4,120,120,3,12,"1,3","24,37","13,21,30,71,89,104,173"],[13,"Star Wars: Imperial Assault",1,5,2,60,120,3,14,"2","3,29,33,46,48,69,80","48,49,61,82,95,131,135,148,157,175"],[14,"Le Havre",1,5,3,30,150,4,12,"1","17,24,37,53","22,54,72,83,107,146,179"],[15,"Azul",2,4,2,30,45,2,8,"5","1,64,68","28,54,110,140,160,168"],[16,"Through the Ages: A Story of Civilization",2,4,3,120,120,4,12,"1","19,24","3,13,15,28,62"],[17,"7 Wonders",2,7,4,30,30,2,10,"1","9,15,17,19,24","51,62,140,142,175"],[18,"Agricola (Revised Edition)",1,4,4,30,120,4,12,"1","10,24,32","53,62,179,8,22,51,72,146,157,168,175"],[19,"Caylus",2,5,3,60,150,4,12,"1","17,24,44","107,168,169,176,179"],[20,"Troyes",1,4,3,90,90,3,12,"1","23,24,44","10,48,54,66,84,107,140,146,170,179,180,181"],[21,"Mombasa",2,4,4,75,150,4,12,"1","24","4,10,28,45,62,75,142,152,175,179"],[22,"Dominion: Intrigue",2,6,3,30,30,2,13,"1","15,44","45,62"],[23,"Patchwork",2,2,2,15,30,2,8,"5","1,64","28,60,71,148,160,161,177"],[24,"Russian Railroads",2,4,4,90,120,3,12,"1","37,74","54,179"],[25,"Código Secreto",2,8,6,15,15,1,14,"3,8","15,22,57,71,81","36,93,122,157"],[26,"Dominion",2,4,3,30,30,2,13,"1","15,44","45,47,62,155,176"],[27,"Pandemic",2,4,4,45,45,2,8,"1","43","3,40,62,118,140,163,175"],[28,"Yokohama",2,4,3,90,90,3,14,"1","24","39,54,61,95,104,140,176,179,181"],[29,"Alchemists",2,4,4,120,120,4,13,"1","22,31","2,28,38,46,54,55,62,170"],[30,"Stone Age",2,4,4,60,90,2,10,"1","23,24,62","39,48,54,140,170,179"],[31,"Star Realms",2,2,2,20,20,2,12,"1","15,33,69","28,45,47,62,155"],[32,"Ticket to Ride: Europe",2,5,4,30,60,2,8,"5","74","28,37,54,62,104,122,140"],[33,"Istanbul",2,5,4,40,60,3,10,"1","24","39,48,61,95,104,114,123,176,179"],[34,"Azul: Summer Pavilion",2,4,2,30,45,2,8,"5","1,64","28,54,110,140,160,168"],[35,"Jaipur",2,2,2,30,30,1,12,"5","10,15,24","28,62,66,89,136,140"],[36,"The Resistance: Avalon",5,10,7,30,30,2,13,"8","13,15,22,31,44,54,57,71","56,65,132,142,157,164,175,178"],[37,"Cosmic Encounter",3,5,5,60,120,3,12,"2","13,54,69,70","9,29,62,74,103,120,123,142,155,163,175"],[38,"Just One",3,7,6,20,20,1,8,"8","57,81","36,40"],[39,"T.I.M.E Stories",2,4,4,90,90,2,12,"2","3,41,64,69","40,48,96,102,153,175"],[40,"Código Secreto: Dúo",2,2,2,15,30,1,11,"3,5","15,22,71,81","36,40,122,157"],[41,"Splendor",2,4,3,30,30,2,10,"5","15,24,68","28,39,123,140"],[42,"Ticket to Ride",2,5,4,30,60,2,8,"5","74","28,39,54,62,104,122,140"],[43,"Ra",2,5,3,45,60,2,12,"1","9,51","13,19,33,38,122,140"],[44,"Carcassonne",2,5,2,30,45,2,7,"5","17,44,73","10,86,160"],[45,"Sushi Go Party!",2,8,4,20,20,1,8,"5","15,57","28,51,54,62,140,142"],[46,"Isle of Skye: From Chieftain to King",2,5,3,30,50,2,8,"5","24,73","13,30,140,160,170"],[47,"Power Grid Deluxe: Europe/North America",2,6,4,120,120,3,12,"1","24,37","21,71,89,104"],[48,"Dixit: Odyssey",3,12,6,30,30,1,8,"8","15,36,57","153,156,178"],[49,"Kingdomino",2,4,2,15,15,1,8,"5","17,44,73","28,51,160"],[50,"Imperial Settlers",1,4,2,45,90,3,10,"1","9,15,17,19","28,39,51,62,155,175"],[51,"Hive",2,2,2,20,20,2,9,"7","1,10","53,61,63,115,145,159,160"],[52,"Small World",2,5,4,40,80,2,8,"5","31,33,73","10,11,16,48,175,176,177"],[53,"Arboretum",2,4,2,30,30,2,8,"5","13,15","62,110,140,160"],[54,"Sid Meier's Civilization: The Board Game",2,4,4,120,240,4,13,"1","17,19,29,54,78","28,45,61,62,95,130,148,163,175"],[55,"La Resistencia",5,10,7,30,30,1,13,"8","13,15,22,54,57,69,71","65,93,132,142,157,164,178"],[56,"Love Letter",2,4,4,20,20,1,10,"5","15,22,68","46,62,116,136"],[57,"Dixit",3,6,5,30,30,1,8,"8","15,36,57","123,142,153,156,178"],[58,"Takenoko",2,4,3,45,45,2,8,"5","10,27,32,73","3,39,48,54,61,63,95,104,110,140,160"],[59,"The Island",2,4,4,45,60,2,8,"5","3,10,13,53","3,48,61,63,88,93,95,137,155"],[60,"Arkham Horror (Third Edition)",1,6,3,120,180,3,14,"2","3,33,35,55","40,48,95,118,150,175"],[61,"Se Vende",3,6,5,30,30,1,10,"5","15,24","13,20,21,62,138"],[62,"Exploradores",2,2,2,30,30,1,10,"5","15,29","62,122,136,140"],[63,"Azul: Stained Glass of Sintra",2,4,3,30,45,2,8,"5","1,64,68","28,54,95,110,140,160,168"],[64,"King of Tokyo",2,6,4,30,30,1,8,"5","23,33,48,69","28,48,49,77,116,122,126"],[65,"Código Secreto: Imágenes",2,8,6,15,15,1,10,"8,3","15,22,57,71","36,93,122,157"],[66,"El Padrino: El imperio Corleone",2,5,4,60,90,3,14,"1","24,39,48","10,13,28,62,93,155,175,179,181"],[67,"Dice Forge",2,4,4,45,45,2,10,"5","9,23,31,51","28,45,48,124"],[68,"Pandemic: Fall of Rome",1,5,3,45,60,2,8,"1","9","3,40,48,62,118,140,146,175"],[69,"Incómodos Invitados",1,8,4,45,75,2,12,"3,5,2","15,22,36,48,49","28,46,62,163"],[70,"Firefly: The Game",1,4,3,120,240,3,13,"2","3,48,69,70,76","11,28,48,114,146,155,163,175"],[71,"Flash Point: Fire Rescue",2,6,4,45,45,2,10,"5","3","3,40,48,61,114,141,146,148,175"],[72,"Quadropolis",2,4,4,30,60,2,8,"5","17,27","62,110,140,160"],[73,"Pandemic: The Cure",2,5,3,30,30,2,8,"1","23,27,43","40,48,62,118,122,126,140,146,175"],[74,"Skull",3,6,5,15,45,1,10,"8","13,15,57","13,62,116"],[75,"El Desierto Prohibido (Forbidden Desert)",2,5,4,45,45,2,10,"5","3,31,69","3,24,40,61,62,88,95,114,140,146,148,175"],[76,"Colt Express",2,6,5,30,40,2,10,"5","8,33,74","4,5,62,93,121,155,175"],[77,"Hanabi",2,5,4,25,25,2,8,"5","15,22,45","36,40,62,93,140"],[78,"Catan",3,4,4,60,120,2,10,"1","24,54","48,63,71,95,104,123,124,163,176"],[79,"Legends of Andor",2,4,4,60,90,3,10,"2","3,31,33,64","11,40,48,135,175"],[80,"Citadels",2,8,5,20,60,2,10,"1","13,15,17,22,31,44","2,28,51,84,140,172,175"],[81,"Small World Underground",2,5,4,30,90,3,8,"1","31,33,73","10,11,48,77,175"],[82,"Friday",1,1,1,25,25,2,13,"1","3,15,33,55,59","45,62,122,146"],[83,"Imhotep",2,4,4,40,40,2,10,"5","9,75","10,54,95,140,179"],[84,"Ajedrez (Chess)",2,2,2,60,60,5,6,"7","1","61,111,148,151"],[85,"Las mil y una noches (Tales of the Arabian Nights)",1,6,3,120,120,2,12,"2","3,11,29,31,76","48,102,118,131,146,153,175"],[86,"Sushi Go!",2,5,4,15,15,1,8,"5","15","28,51,54,62,140,142"],[87,"Bohnanza",2,7,4,45,45,2,13,"5","15,32,54","62,92,103,140,163"],[88,"Pathfinder Adventure Card Game: Rise of the Runelords – Base Set",1,4,3,90,90,3,13,"3,2","3,15,31,33","40,45,48,62,131,135,146,175"],[89,"Port Royal",2,5,3,20,50,2,8,"5","15,24,53,59","28,39,122,140"],[90,"Karuba",2,4,4,30,40,1,8,"5","29,64","25,37,61,104,123,142,160"],[91,"Colosseum",3,5,5,60,90,3,10,"5","9,54","13,48,133,140,163"],[92,"Hadara",2,5,4,45,60,2,10,"1","17,19","28,54,93,140,142"],[93,"Alhambra",2,6,3,45,60,2,8,"1","11,17,44","28,62,93,140,160"],[94,"A Game of Thrones",3,5,5,180,180,4,12,"1","13,31,54,55,60,80","11,13,55,62,93,106,116,142,175"],[95,"Carcassonne: Hunters and Gatherers",2,5,2,35,35,2,8,"5","62","10,86,160"],[96,"Quantum",2,4,4,60,60,2,13,"1","23,33,69,70","10,48,61,95,148"],[97,"Coup",2,6,5,15,15,1,13,"8","13,15,22,57,60","65,93,116,155,175"],[98,"Valeria: Card Kingdoms",1,5,3,30,45,2,13,"1","15,23,31","28,48,124,176"],[99,"Magic Maze",1,8,4,15,15,2,8,"5","29,31,42,66","36,40,52,61,86,95,127,146,175"],[100,"Dixit: Journey",3,6,5,30,30,1,8,"8","15,36,57","1,142,153,156,178"],[101,"Mr. Jack",2,2,2,30,30,2,9,"1","22,49","51,61,175"],[102,"Coloretto",2,5,4,30,30,1,8,"5","10,15","28,122,140"],[103,"The Red Cathedral",1,4,3,30,120,3,10,"1","23,24","10,48,54,128,134,146,177,179,180"],[104,"Kingdom Builder",2,4,4,45,45,2,8,"1","44,73","10,31,53,63,95,176"],[105,"Elder Sign",1,8,4,90,90,2,13,"2","3,15,23,31,33,35,55","40,48,49,95,126,146,175"],[106,"Cacao",2,4,3,45,45,2,8,"5","24,32,73","10,62,86,160"],[107,"Tokaido",2,5,4,45,45,2,8,"5","76","54,140,161,162,175,179"],[108,"The Oracle of Delphi",2,4,3,70,100,3,12,"1","9,51,53","3,48,61,95,114,122,123,175"],[109,"HeroQuest",2,5,5,90,90,2,14,"2","3,29,31,33","48,49,61,95,131,133,135,148,157,175"],[110,"BANG! The Dice Game",3,8,6,15,15,1,8,"8","8,13,22,23,33,57","48,65,116,122,126,157,175"],[111,"Toma 6!",2,10,5,45,45,1,8,"5","15,56","62,76,136,142"],[112,"Ascension: Deckbuilding Game",1,4,2,30,30,2,13,"1","15,31","28,45,62"],[113,"Disney Villainous",2,6,3,50,50,2,10,"5","15,31,44,48,51,55,59","62,155,175"],[114,"Oh My Goods!",2,4,2,30,30,2,10,"1","15,24,44","4,62,122,140"],[115,"Deep Sea Adventure",2,6,4,30,30,1,8,"5","23,29,53,57","114,122,133"],[116,"Blue Moon City",2,4,3,30,50,2,14,"1","17,31","10,61,62,95,140"],[117,"The Mind",2,4,4,20,20,1,8,"8","15,56","36,40"],[118,"Finca",2,4,2,45,45,2,10,"5","24,32","39,85,105,134,140"],[119,"13 Days: The Cuban Missile Crisis",2,2,2,45,45,2,10,"4","13,47,60,80","7,8,10,27,54,62,166"],[120,"Red7",2,4,4,5,30,2,9,"5","15,56","62,116,140,176"],[121,"Not Alone",2,7,4,30,45,2,10,"1","13,15,22,69","45,62,142,157"],[122,"Rhino Hero: Super Battle",2,4,3,10,20,1,5,"5","2,10,16","48,144,149"],[123,"Ca$h 'n Guns (Second Edition)",4,8,6,30,30,1,10,"8","13,33,36,39,54,57","28,116,142,155,175"],[124,"Santiago",3,5,5,75,75,2,10,"1","32,54","10,13,26,35,160"],[125,"Fungi",2,2,2,30,30,2,10,"5","15,25","28,62,140"],[126,"Diamant",3,8,6,30,30,1,8,"5","3,13,29","96,122,142"],[127,"Rhino Hero",2,5,3,5,15,1,5,"5","2,10,16,57","62,84,149"],[128,"La Isla Prohibida",2,4,4,30,30,2,10,"5","3,31","3,40,61,62,88,95,114,140,146,175"],[129,"Dale of Merchants",2,4,2,30,30,2,10,"1","10,15,31","28,45,48,62,123,140,155"],[130,"Tragedy Looper",2,4,4,120,120,3,13,"2","13,15,22,49","36,46,61,62,93,157"],[131,"The Others",2,5,5,90,90,3,14,"2","31,33,35,46","10,11,48,74,95,157,175"],[132,"Wizard",3,6,4,45,45,2,10,"5","15","23,62,119,165"],[133,"La Posada Sangrienta",1,4,4,30,60,2,14,"1","15,24,35,61","28,54,62,71,107,141,146"],[134,"Flick 'em Up!",2,10,4,30,45,1,7,"2","2,8,33","57,114,157"],[135,"Concept",4,12,6,40,40,1,10,"8","22,57","36,157"],[136,"Parade",2,6,4,45,45,1,12,"5","15,55","62,140"],[137,"Qwirkle",2,4,4,45,45,1,6,"5","1","62,110,160"],[138,"Mr. Jack Pocket",2,2,2,15,15,2,14,"1","13,22,49,61","87,95"],[139,"Valley of the Kings",2,4,2,45,45,2,14,"1","9,15,51,67","28,45,62,140"],[140,"El Gran Libro de la Locura",2,5,3,60,90,3,12,"1","15,31","40,45,62,116,175"],[141,"When I Dream",4,10,6,20,40,1,8,"8","22,57,66,81","36,93,131,153,157"],[142,"Loony Quest",2,5,4,20,30,1,8,"5","2,16,31,66","81"],[143,"Mr. Jack in New York",2,2,2,30,30,2,14,"1","22,49","61,175"],[144,"Riverboat",2,4,4,90,90,3,10,"1","32","28,140,160"],[145,"Fauna",2,6,4,45,60,1,8,"5","10,25,77","23"],[146,"Smash Up",2,4,3,45,45,2,12,"1","15,31,36,59,69,84","10,28,29,44,62,155,175,176"],[147,"Dream Home",2,4,3,30,30,2,7,"5","15","28,93,110,140,174"],[148,"Animal Sobre Animal",2,4,4,15,15,1,4,"9","2,10,16","48,149"],[149,"Steam Park",2,4,4,60,60,2,10,"5","17,23,66,69","28,48,93,95"],[150,"Caylus 1303",2,5,4,60,90,3,12,"1","17,24,44","107,168,169,176,179"],[151,"Catan Card Game",2,2,2,60,120,2,10,"1","15,17,73","28,48,62,163"],[152,"Machi Koro",2,4,4,30,30,1,10,"5","17,23","48,124"],[153,"Cockroach Poker",2,6,5,20,20,1,8,"8","13,15,57","62,140,144"],[154,"Colossal Arena",2,5,3,40,60,2,8,"1","15,31,51","23,62"],[155,"Mission: Red Planet",3,5,4,60,60,2,10,"1","69,70","5,10,11,54,62,142,155,172"],[156,"Santiago de Cuba",2,4,2,40,75,2,10,"1","24","35,48,93,95,114,129,162,179"],[157,"Ponzi Scheme",3,5,4,60,90,2,12,"1","24","140,163"],[158,"Poker Set",2,10,5,60,60,2,12,"1","13,15","23,116,140"],[159,"The Werewolves of Miller's Hollow",8,18,11,30,30,1,10,"8","13,22,35,49,57","116,131,157,175,178"],[160,"Virrey (Viceroy)",1,4,3,45,60,3,13,"1","13,15,17,19,31,54","20,28,62,93,140,160"],[161,"Evo",3,5,4,60,120,2,12,"1","10,62,69","10,11,13,48,62,173,175,177"],[162,"Rialto",2,5,4,45,45,0,10,"1","60,68","10,13,28"],[163,"Ubongo",1,4,4,25,25,1,8,"5","64,66","60,110,140"],[164,"The Magic Labyrinth",2,4,3,20,30,1,6,"5","16,31,42,45","48,61,93,104,133"],[165,"Timeline: Inventions",2,8,4,15,15,1,8,"5","15,25,77",""],[166,"Saboteur",3,10,7,30,30,1,8,"8","13,15,29,31,57","62,65,86,104,155,157,164"],[167,"Fantasma Blitz",2,8,4,20,20,1,8,"5","2,15,16,66","112,147"],[168,"Dobble",2,8,4,15,15,1,7,"8","15,16,25,57,66,72","112,147"],[169,"Bienvenido a la Mazmorra",2,4,3,30,30,1,10,"8","13,15,31,33","23,93,116,122"],[170,"Aton",2,2,2,30,30,2,8,"1","9","10,62,142"],[171,"Mascarade",2,13,6,30,30,1,10,"8","13,15,44,57","65,93,175"],[172,"Timeline: Events",2,8,4,15,15,1,8,"5","15,25,57,77",""],[173,"Agricola: Family Edition",1,4,3,45,45,2,8,"1","10,32","22,179"],[174,"Quoridor",2,4,2,15,15,2,8,"7","1,42","61,148"],[175,"Piko Piko El Gusanito",2,7,3,20,20,1,8,"5","10,23","48,122,126"],[176,"Bar Bestial",2,4,4,20,20,1,8,"5","10,15,36","4,62,155"],[177,"Scotland Yard",3,6,0,45,45,2,10,"5","22,76","64,118,137,157"],[178,"BANG!",4,7,7,20,40,1,10,"8","8,13,15,22,33","62,65,76,116,155,157,175"],[179,"Backgammon",2,2,2,30,30,2,8,"7","1,23","8,23,48,133,162"],[180,"Ishtar: Gardens of Babylon",2,4,3,45,45,2,14,"5","9","10,134,160"],[181,"Fireteam Zero",1,4,3,90,90,3,14,"1","3,31,33,35,46,83","40,45,48,153,175"],[182,"Dice Settlers",1,4,3,45,60,3,14,"1","8,19,23,29,73","10,45,48,86,140,146,160"],[183,"Pitch Car",2,8,4,30,30,1,6,"8","2,65","57,123"],[184,"El Diablo de la Botella",2,4,3,30,30,2,10,"1","15,55","136,165"],[185,"Jungle Speed",2,8,5,10,10,1,7,"8","2,15,57,66","112,147"],[186,"Small World of Warcraft",2,5,4,40,80,3,8,"1","31,33,73,78","10,11,48,72,157,175,177"],[187,"Timeline: Música y Cine",2,8,4,15,15,1,8,"3,8,5","15,25,50,57,77",""],[188,"El Favor del Faraón (Favor of the Pharaoh)",2,4,2,45,45,2,13,"3,5","23","45,48"],[189,"Tranvía (Trambahn)",2,2,2,30,45,2,8,"3,5","15,74,75","28,140"],[190,"Duplik",3,10,5,45,45,1,12,"8","36,57","81"],[191,"Niagara",3,5,4,30,45,2,8,"5","53","24,62,114,140,142"],[192,"Trapwords",4,8,6,30,45,1,8,"8","29,31,57,81","95,153,157,161"],[193,"A Game of Thrones: Hand of the King",2,4,2,15,30,1,14,"5","1,15,31","28,61,140"],[194,"Treasure Hunter",2,6,4,40,40,2,8,"5","3,15,31","28,62,142"],[195,"Carcassonne Junior",2,4,4,10,20,1,4,"9","16,44","53,95,160"],[196,"Criaturas de serie B",2,5,4,20,30,1,10,"5","13,15,22,35","13,62,140,142"],[197,"Time's Up! Edición Azul",4,12,6,45,45,1,12,"3,8","36,48,57","1,36,93,157"],[198,"2 de Mayo",2,2,2,20,20,2,12,"4","52,80","11,62,108,141,142"],[199,"Time's Up! Edición Amarilla",4,12,6,30,30,1,0,"3,8","36,57","1,36,93,157"],[200,"Samurai Sword",3,7,7,20,40,2,8,"5","13,15,22,33,44","62,157,175"],[201,"Rumbo a la India",3,4,3,60,60,2,14,"1","24,29,53,68","3,11,140,179"],[202,"Virus!",2,6,4,20,20,1,8,"8","15,43","62,140,155"],[203,"Rummikub",2,4,4,60,60,2,8,"5","1,15,56","92,140,160"],[204,"Labyrinth",2,4,4,20,20,1,8,"5","16,42,64","87,95,104,118,160"],[205,"Zombie 15'",2,4,4,15,15,2,14,"2","33,35,66,84","3,40,61,95,175"],[206,"Mafia de Cuba",6,12,8,10,20,1,10,"8","13,22,39,57","131,157,175"],[207,"Machi Koro: Legacy",2,4,3,30,45,2,10,"5","","48,80"],[208,"Poli Bueno Poli Malo",4,8,6,10,20,1,12,"8","13,15,22,57,71","9,62,65,93,116,155"],[209,"Escape from Colditz",2,6,4,180,180,2,12,"2","3,83","28,52,61,63,133,140,141"],[210,"After The Virus",1,3,1,30,90,2,10,"2","15,35,84","40,45,62,146"],[211,"Crónicas (Chronicle)",3,6,4,30,30,2,12,"3,1,5","15,31","5,140,155,165"],[212,"Drako: Dragon & Dwarves",2,2,2,30,30,2,8,"2","31,33","3,27,61,62,63,175"],[213,"Catan: Junior",2,4,4,30,30,1,6,"5","16,24,53,59","48,104"],[214,"Scrabble",2,4,2,90,90,2,10,"5","81","54,62,148,160"],[215,"Timebomb",4,8,6,1,30,1,10,"8","13,15,57,71","65,131,157,164"],[216,"Time of Soccer",1,4,3,120,120,3,12,"1","24,72","48,140,141"],[217,"Fuji Flush",3,8,6,10,20,1,7,"5","15,56","62,155"],[218,"Código Secreto: Disney – Family Edition",2,8,6,15,15,1,8,"3,8","15,22,48,57,81","36,93,112,122,157"],[219,"My First Stone Age",2,4,3,15,15,1,5,"9","16,45,62","93,140"],[220,"Pandemic: Rapid Response",2,4,0,20,20,2,8,"1","43,66","39,40,48,126,175"],[221,"Epic Card Game",2,4,2,20,40,2,13,"8","15,31,33,62,84","28,62,155"],[222,"Muse",2,12,4,30,30,1,10,"8","15,36,57","36,40,156,157,178"],[223,"Pandemic: Hot Zone – North America",2,4,2,30,30,2,8,"5,3","43,63","3,40,62,118,140"],[224,"Boss Monster: The Dungeon Building Card Game",2,4,4,30,30,2,13,"5","15,31,78","62,116,155,175"],[225,"Famiglia",2,2,2,30,30,2,10,"1","15,39","5,28,45,62"],[226,"Mundus Novus",2,6,4,45,60,2,14,"1","15,24,53,68","28,62,140,163"],[227,"Dungeon Raiders",3,5,5,20,60,1,8,"2","3,13,15,29,31,33","62,116,142,155,175"],[228,"¿Alcachofas? ¡No, gracias!",2,4,2,20,20,1,10,"3,5","15,32","28,45"],[229,"Micropolis",2,6,3,30,30,2,8,"5","10,73","28,140,160"],[230,"Cave Troll",2,4,4,20,60,2,10,"2","31","3,10,62,118,175"],[231,"Pandemic: Contagion",2,5,4,30,30,2,14,"1","15,43","10,62"],[232,"De mudanzas",3,6,6,30,45,1,10,"5","2,64,66","48,142"],[233,"Zombie Dice",2,99,4,10,20,1,10,"8","23,35,36,57,84","48,122,126"],[234,"Monza",2,6,4,10,10,1,5,"9","16,23,65,72","48,123,133,162"],[235,"Cheating Moth",3,5,5,30,30,1,7,"8","2,15","62"],[236,"The Fury of Dracula",2,4,4,180,180,3,12,"2","3,22,33,35,55","64,118,137,157,175"],[237,"Gift Trap",3,8,5,60,60,1,8,"8","36,57","142,178"],[238,"Scattergories",2,6,4,30,30,1,12,"8","57,66,81","48,108"],[239,"Rory's Story Cubes",1,12,2,20,20,1,6,"8","16,23","40,48,112,153"],[240,"Blood Bound",6,12,8,30,30,2,14,"8","13,22,31,35,54,57","131,157,175"],[241,"Sherlock: Last Call",1,8,0,40,60,1,10,"2","15,22,49","36,40,62,93"],[242,"Topoum",2,4,0,60,90,0,14,"1","73,82","10,160"],[243,"Sonora",1,4,4,30,45,2,10,"7","1,2,10","3,10,31,53,57,104,108,140"],[244,"Shark",2,6,4,90,90,2,12,"1","24","35,48,152"],[245,"Fight for Olympus",2,2,2,30,30,2,12,"1","9,15,51","62,155,166"],[246,"Aliens",1,9,1,90,90,2,10,"2","33,35,48,69","40,48,135,148,175"],[247,"Mi Primer Frutal",1,4,3,10,10,1,2,"9","16,25,32","40,48"],[248,"Stratego",2,2,2,45,45,2,8,"5","1,13,22,33,45,52,80","61,93,137,148,176"],[249,"Camel Up Cards",2,6,4,30,60,2,8,"5","15","23,62"],[250,"Byzanz",3,6,0,45,45,2,8,"5","9,11,15,24","13,21,28,33,38,62,140"],[251,"La Torre Encantada",2,4,2,15,25,1,5,"9","13,16,23,31","48,133"],[252,"Exploding Kittens: NSFW Deck",2,5,4,10,20,1,18,"8","10,15,21,36,41","62,116,122,140,155"],[253,"Pairs",2,8,5,15,15,1,0,"5","15","122"],[254,"Dungeon Roll",1,4,2,15,15,1,8,"5","23,31,33","48,62,122,175"],[255,"1911 Amundsen vs Scott",2,2,2,20,20,2,12,"2","15,29","28,62,123"],[256,"La Escalera Encantada",2,4,4,10,15,1,4,"9","16,31,45","93,133"],[257,"El cuco Kiko estrena nido",2,5,4,10,15,1,4,"5","2,16,57","149"],[258,"Unstable Unicorns",2,8,4,30,45,1,14,"8","15,36,57","62,140,155"],[259,"Haru Ichiban",2,2,2,20,20,2,8,"7","1,10,64","61,62,93,110,142"],[260,"Sherlock: La tumba del arqueólogo (Sherlock: The Tomb of the Archaeologist)",1,8,4,40,60,1,10,"3,10","15,22,49","36,40,62,93"],[261,"Game of Trains",2,4,0,20,20,1,8,"5","15,64,74","28,110"],[262,"Catan Histories: Struggle for Rome",3,4,4,120,120,3,10,"1","9,19","11,163"],[263,"El Séptimo Héroe",3,5,3,20,30,1,8,"5,3","13,15,31","62,140,155"],[264,"Star Wars: Empire vs. Rebellion",2,2,2,60,60,2,10,"5","13,15,48,69","45,62,175"],[265,"Concept Kids: Animals",2,12,4,20,20,1,4,"9","10,16,22","40"],[266,"Time's Up! Family",4,12,6,30,30,1,8,"5","45,57","1,36,93,157"],[267,"Munchkin Zombies",3,6,4,90,90,2,10,"2","15,33,36,84","48,62,175"],[268,"13 Minutes: The Cuban Missile Crisis, 1962",2,2,2,13,13,2,10,"1","15,60","10,27,62"],[269,"Ensalada de Bichos",2,6,4,10,20,1,6,"8","2,15,36,66","112"],[270,"Rolling Ranch",2,20,4,10,20,1,14,"5","10,23,73","48,108"],[271,"Alcatraz: El Chivo Expiatorio",3,4,4,45,60,2,15,"2","13,39,54","3,61,95,114,140,144,163,178"],[272,"Ritmo y Bola",4,12,8,30,30,1,8,"8","2,36,50,57,66","1,93,112"],[273,"Exploding Kittens",2,5,4,15,15,1,7,"8","10,15,21,36","62,68,116,122,140,155"],[274,"Lobo (Wooly Wars)",2,4,0,30,30,2,7,"5","10,13,32,64","53,62,116,160"],[275,"Zombicide: Dark Side",1,6,2,60,60,2,14,"2","46,69,84","3,40,48,95,175"],[276,"Colt Super Express",3,7,5,15,20,1,7,"7","8,74","4,62,93,116,121,142"],[277,"Versailles",2,5,0,90,90,3,12,"1","73","118,134,160"],[278,"Hex",2,2,2,20,20,2,8,"7","1","63,104"],[279,"Cerberus",3,7,5,30,45,2,10,"8","3,51,54","62,95,139"],[280,"Cthulhu Fluxx",2,6,4,5,30,1,8,"8","15","62,140"],[281,"Rory's Story Cubes: Actions",1,12,3,20,20,1,6,"5","23","40,48,112,153"],[282,"Bubblee Pop",1,2,2,20,20,1,8,"5","","110"],[283,"Speed Cups",2,4,4,15,15,1,6,"8","2,16,66","110"],[284,"El Valle de los Vikingos",2,4,3,15,20,1,6,"9","2,16","133,179"],[285,"Arcana",2,4,4,60,60,2,13,"1","13,15,31","10,45,62,137,140,165,175"],[286,"10' to Kill",2,4,4,10,15,2,12,"8","10,13,22,49","4,93,95,116,137"],[287,"Zombie Fluxx",2,6,4,10,40,1,8,"8","15,84","62,140,155"],[288,"Sherlock: Death on the 4th of July",1,8,4,40,60,1,10,"2","15,22,49","36,40,62,93"],[289,"Gravity Superstar",2,6,4,15,30,1,7,"5","78","61,62,95"],[290,"Miguel Strogoff",1,5,0,60,60,2,12,"2","55","48,62,116,118,122,123,139"],[291,"Twilight Imperium",2,6,0,240,240,4,12,"2","19,54,60,69,70,80","48,63,95,160,175,178"],[292,"BANG! The Duel",2,2,2,30,30,2,8,"1","8,15","62"],[293,"1920 Wall Street",2,5,3,45,60,2,12,"1","15,24","75,140,152"],[294,"El Frutal",2,8,3,10,10,1,3,"9","16,23","40,48"],[295,"Gardens",2,4,4,45,45,2,8,"5","27","112,160"],[296,"Frente a los Ascensores (In Front of the Elevators)",2,4,4,20,40,1,8,"5","15","10,62"],[297,"HMS Dolores",2,4,3,10,20,1,10,"8","15,54,59","120,130,140,142"],[298,"Dr. Jekyll & Mr. Hyde",3,4,4,60,60,2,10,"1","13,15","165"],[299,"Huida de Silver City",1,4,4,120,120,2,12,"2","33,35,84","40,48,62,131,157,175"],[300,"Brick Party",2,9,4,15,30,1,5,"8","2,57,66","40,62"],[301,"Sailing Toward Osiris",2,5,4,60,90,3,14,"2","9,54","110,179"],[302,"Black Stories 2",2,15,5,20,20,1,12,"8","15,22,35,36,49,57",""],[303,"Zombies!!! 4: The End...",2,6,4,60,120,1,16,"2","29,33,35,46,48,84","133,160"],[304,"Scarab Lords",2,2,2,20,40,2,12,"1","9,15,31","10,45,62"],[305,"Silk",2,4,3,45,45,2,10,"1","10,32","10,48,155,179"],[306,"Sherlock: 13 Rehenes (Sherlock: 13 Hostages)",1,8,4,60,60,0,8,"2","15,22,49","36,40,62,93"],[307,"Tomb: Cryptmaster",2,6,3,120,120,3,12,"2","3,29,31,33,44","48,93,95,137"],[308,"Dobble 1,2,3",2,6,4,15,15,1,4,"9","10,15,16,25,57,66","112,147"],[309,"Kreus",3,6,4,20,30,2,10,"2","15,22,51","36,40"],[310,"Karuba: The Card Game",2,6,4,10,15,1,8,"5","3,15,64","110,142,160"],[311,"Costa Rica",2,5,3,30,45,1,8,"5","29","88,122,140"],[312,"Rattle, Battle, Grab the Loot",2,5,4,45,60,2,8,"5","23,36,53,59","48,91"],[313,"Harvest Island",2,4,2,30,40,2,8,"5","10,15","62,140"],[314,"Tesoros Inesperados",3,6,0,30,30,1,13,"5","","140,142"],[315,"Munchkin",3,6,4,60,120,2,10,"8","15,31,33,36","62,155,175"],[316,"The Hobbit",2,5,3,30,45,2,8,"5","3,15,31,55,76","13,48,62,118,131,142"],[317,"Kill The Unicorns",3,6,4,25,45,2,10,"8","10,13,15,57","13,62,140,155,175"],[318,"Pictionary",3,16,6,90,90,1,12,"8","57","81,133,157"],[319,"Micro Robots",2,99,4,20,20,2,8,"7","1,64,66","48,61,95"],[320,"Cards Against Humanity",4,30,6,30,30,1,17,"8","15,36,41,57,63","62,117,142"],[321,"Sopa de Bichos",2,6,6,10,20,1,6,"8","10,15,36,66","112"],[322,"Password",3,4,4,30,30,1,10,"5","48,57,81","157"],[323,"Checkpoint Charlie",3,5,5,20,30,1,10,"5","15,22,71","93,112"],[324,"Rumble in the House",3,6,6,20,20,1,8,"5","13,22,33,36,57","61,95,137"],[325,"So Clover!",3,6,3,30,30,1,10,"8","57,81","40,156"],[326,"Zen Master",3,5,0,30,30,1,8,"5","15","62,140,165"],[327,"Warehouse 51",3,5,5,30,45,2,10,"2","15,51","13,140"],[328,"Target Earth",1,4,4,90,90,3,12,"2","69","40,48,141"],[329,"La Cosa",4,12,6,15,60,1,12,"8","13,15,22,35,57","28,40,116,131,153,157"],[330,"Aye, Dark Overlord! The Red Box",4,16,4,30,30,1,13,"8","15,31,36,57","1,131,144,153"],[331,"Speed Cups²",2,2,3,10,10,1,6,"3,9,8","2,16,66","110"],[332,"Rory's Story Cubes: Enchanted",1,12,3,15,15,1,8,"7","23","40,48,112,153"],[333,"Cluedo",2,6,0,40,40,2,8,"5","13,22,49","48,133"],[334,"Adventure Time Card Wars: Finn vs. Jake",2,2,2,30,30,2,10,"2","15,36,48","62"],[335,"Rory's Story Cubes: Prehistoria",1,12,0,15,15,1,8,"7","23","40,48,112,153"],[336,"Guilds",2,4,3,60,90,2,10,"2","17,31,44","4,13,160"],[337,"Super Munchkin",3,6,4,90,90,2,10,"2","15,21,33,36","48,163,175"],[338,"Papua",2,4,3,75,75,3,10,"1","29","13,48,140,179"],[339,"Adventure Games: The Grand Hotel Abaddon",1,4,2,75,75,0,12,"2","","40"],[340,"Código Secreto 13+4",2,4,3,15,15,1,8,"10,3","25,40,71","48"],[341,"Chariot Race",2,6,6,15,45,2,8,"5","9,65","48,123"],[342,"Oilfield",2,5,4,60,60,3,12,"1","24,37,54","10,13,142,179"],[343,"Poule Poule",2,8,4,20,20,1,8,"9","10,45,57,66","93"],[344,"Prohis",3,6,6,20,20,1,10,"5","13,15,39","26,62"],[345,"Troika",2,5,3,20,20,1,7,"7","","140"],[346,"Mecanisburgo",2,6,4,120,120,4,14,"2","24,31,69","10,28,137,179"],[347,"Time's Up! Kids",2,12,4,20,20,1,4,"9","16,57","1,36,93,157"],[348,"Mixmo",2,6,4,15,15,1,8,"8","57,81","160"],[349,"El Monstruo de Colores",2,5,2,25,25,1,3,"9","16","40,48,93,153"],[350,"Dino Race",2,4,4,30,30,1,8,"9","15,65","62,155"],[351,"Carrera de Caracoles",2,4,4,15,15,1,5,"9","16,23","48"],[352,"A lo loco Retro",2,5,0,5,10,1,8,"7","15,66","112"],[353,"Pocket Invaders",2,4,2,10,20,2,8,"7","1,23","61,133"],[354,"Black Hills",2,4,3,30,60,2,10,"2","6,8,15","174"],[355,"Dragons",3,6,4,30,30,1,8,"2","15,31","28,122,140"],[356,"Cat Box",2,5,4,15,30,1,6,"5","1,10,15","110"],[357,"Zombies!!!",2,6,4,60,90,1,15,"2","29,33,35,46,48,84","48,61,62,95,133"],[358,"Los Impostores",3,6,5,10,20,2,14,"8","13,22,49,57","93,178"],[359,"Catan Dice Game",1,4,2,15,15,1,7,"5","23","48,108,140"],[360,"Mondrian: The Dice Game",2,4,4,30,30,1,10,"7","2,23","62"],[361,"Rory's Story Cubes: Intergalactic",1,10,0,20,20,1,6,"7","23","40,48,112,153"],[362,"Barcelona: The Rose of Fire",2,4,4,70,90,3,10,"1","17","10,160"],[363,"MOON",1,4,1,15,30,0,10,"7","1,25,40","110,141"],[364,"It's Mine",2,2,2,20,45,2,12,"7","15,17,39","10,140,142,155,175"],[365,"Pot de Vin",3,6,4,30,45,2,14,"2","60,68","62,140,165"],[366,"Excalibur",2,6,4,120,120,3,14,"1","33,44,80","4,48,108,118,142"],[367,"Time's Up! Party Edition",4,12,4,45,90,1,12,"8","36,57","1,93,157"],[368,"Spartacus",2,2,2,300,300,3,12,"4","9,18,60,80","27,118,141"],[369,"Junta: Las Cartas",3,6,6,45,60,2,12,"5","13,15,54,60","62,137,141,142,155,178"],[370,"Fast Food Fear!",3,6,4,10,30,1,8,"8","57,66","40,140"],[371,"Black Stories 3",2,15,4,45,45,1,14,"8","15,22,35,36,49,57",""],[372,"Final Touch",2,4,2,15,15,1,8,"5","13,15","62,157"],[373,"What's Up",2,4,2,10,20,1,8,"5","10,22,45","93,140"],[374,"Mil Kilometros: Fun & Speed",2,6,4,45,45,1,8,"5","15,65","62,155,157"],[375,"Emporion",2,4,4,30,45,2,12,"2","9,15,19","28,140"],[376,"Ars Universalis",2,4,3,45,45,2,10,"5","1,25,44,64,68","13,110"],[377,"Karuba Junior",1,4,3,5,10,1,4,"9","3,16,64","40,95,160"],[378,"Unicornio Destello",2,4,3,10,10,1,3,"9","16","48,133"],[379,"Hands Up",2,8,6,20,20,1,6,"8","2,15","110"],[380,"Hombres Lobo de Castronegro",8,28,0,30,30,0,14,"8","13,22,35,49,57","116,131,157,175,178"],[381,"Ubongo Junior",2,4,4,20,20,0,5,"9","64,66",""],[382,"Fire Team",2,2,0,240,240,3,12,"4","47,80","3,32,48,61,63,82,95,135,141"],[383,"Simon's Cat Card Game",3,6,4,10,25,1,6,"9","15,21,36,48,56,57","62,93,144,165"],[384,"Odyssey: La Ira de Poseidon (Odyssey: Wrath of Poseidon)",2,5,2,30,30,2,13,"2","22,53","11,157"],[385,"Upstream",2,5,4,25,40,2,8,"7","1,10,27,65","3,61,95,160"],[386,"Mi Primer Tesoro de Juegos",1,6,3,5,5,0,3,"9","10,16,32","40,93,112"],[387,"No Time For Heroes",1,4,4,25,45,2,8,"4","15,31,33","28,62,175"],[388,"Sidibaba",3,7,0,45,45,2,14,"5","9,11,42,51,63,66","142,157,175,178"],[389,"Cranium",4,16,8,60,60,1,13,"8","57,64,77,81","1,81,108,133,143,157"],[390,"Co-Mix",3,10,4,30,30,1,6,"8","21,36,57","153,178"],[391,"¡Cobardes!",2,2,2,5,15,1,10,"3,10","15,44","62,142,175"],[392,"Rory's Story Cubes: Mythic",1,12,0,20,20,1,6,"7","23","40,48,112,153"],[393,"Rory's Story Cubes: Animalia",1,12,0,20,20,0,6,"7","23","40,48,112,153"],[394,"Hippo",2,4,4,15,20,1,6,"9","","48,95"],[395,"Rally de Zanahorias",2,4,3,15,15,1,4,"9","10,16","48,98,118"],[396,"Galactic Warlords: Battle for Dominion",1,4,2,30,90,3,8,"4","70,71,80","10,28,48,95,175"],[397,"Air Show",2,5,3,60,90,3,14,"2","12","13,140"],[398,"Alice",2,4,0,35,40,2,10,"2","3,31,55","28,140"],[399,"Fuerza de Dragón",2,4,3,15,15,1,5,"3,9","16,45,65","93"],[400,"Palabrea",1,10,0,10,15,1,6,"8","15,57,66,81",""],[401,"Basketball Age",2,2,2,80,120,3,12,"2","72","4,11,48,141,175"],[402,"Fluxx",2,6,4,5,30,1,8,"5","15","62,140"],[403,"Trivial Pursuit: Classic Edition",2,6,3,45,90,1,16,"5","57,77","133,140"],[404,"Aye, Dark Overlord! The Green Box",4,7,5,30,60,1,14,"8","15,31,36,57","1,131,144,153"],[405,"Ladrillazo",1,6,4,60,90,2,18,"5","24,54,60","28"],[406,"Humans!!!",2,6,5,60,60,2,0,"2","33,35,36,84","62,160,175"],[407,"El Mortal",2,6,6,20,20,1,10,"8","15,36","155"],[408,"SecuenzooS",2,5,4,30,30,1,8,"5","10,45,65","93,95,175"],[409,"Manos ¡Arriba! (Hands)",3,8,8,20,20,1,8,"10,3","15,57,66","1,112"],[410,"Matterhorn",2,4,0,10,30,0,8,"5","23,72","48,122"],[411,"Provincia Romana",2,6,0,90,90,3,13,"1","9,15","28,62"],[412,"1,2,3! Now you see me...",2,8,0,15,15,1,6,"8","15,45,57","93"],[413,"Entern!",2,2,2,10,25,2,10,"2","15,53,59,63","10,28,130,142,175"],[414,"Misterio",2,6,4,60,60,1,9,"2","22,31,35,49","62,133"],[415,"El Soneto",2,4,0,60,60,3,12,"2","81","108,140"],[416,"Sector 6",1,6,2,30,60,2,8,"7","1,42","53,61,95"],[417,"Rick and Morty: 100 Días",2,4,3,45,70,2,16,"10,3","","4,28,179"],[418,"Cubulus",2,3,2,20,20,2,8,"7","1","110"],[419,"What's Missing?",3,6,0,20,20,1,7,"8","36,57,66","81,108"],[420,"Jenga",1,8,4,20,20,1,6,"8","2,57","113,144,149"],[421,"Doggy Bag",2,6,4,20,45,1,8,"8","10,13,57","23,122"],[422,"Alakazum!: Witches and Traditions",2,5,3,20,40,2,10,"5","15,23,31,33","48,62,140"],[423,"Catan Junior Madagascar",2,4,4,30,30,2,6,"9","10,16,23,48","48,104,163"],[424,"Mascotas",2,8,6,15,30,2,4,"9","10,15,16","1"],[425,"Help Me!",2,6,2,10,10,1,7,"7","1,10,13,57","157,160"],[426,"Eureka",3,6,4,60,60,1,8,"5","8,29","48,61,114,122,133"],[427,"Alchemical Crystal Quest (Second Edition)",1,4,4,40,120,3,14,"2","3,31,33,46","40,48,95,153,175"],[428,"15 Dias: The Spanish Golden Age",2,8,4,60,60,3,12,"1","15,54,60,68","62,174"],[429,"Rory's Story Cubes: Medieval",1,99,0,10,10,0,6,"7","23,44","153"],[430,"El Valle Secreto",2,4,0,30,40,0,10,"2","15","51,62,95"],[431,"Time's Up! Family 2",4,12,0,30,30,0,8,"8","57","1,36,157"],[432,"Total Rumble",2,12,9,20,20,1,8,"2","15,33","28"],[433,"Mia",2,12,5,20,20,1,8,"5","13,23","23,48"],[434,"Cortex Challenge KIDS",2,6,0,15,30,1,6,"8","15,57",""],[435,"Black Stories: Shit Happens Edition",2,15,6,20,20,1,12,"8","15,22,35,36,49,57","153"],[436,"Aliens: Hadley's Hope",2,6,5,60,90,0,14,"5","13,35,48,69","3,40,95,164,175"],[437,"Waterloo 1815",2,6,6,720,720,5,0,"4","52,80","63"],[438,"El Ministerio del Tiempo",2,4,2,45,60,2,10,"2","3,48","3,140"],[439,"Contrast",2,6,5,10,20,1,8,"8","15,57","112,142,178"],[440,"¡MÍA!",1,6,3,10,20,1,6,"3,10","15,16,25,40,56,64","28,62,93,108"],[441,"Dragons & Chickens",2,5,4,15,20,1,8,"5","2,3,15,29,31,36","112,142,155"],[442,"La Familia Hort",2,4,4,30,40,1,8,"5","10,15,24,32,35","89,107,175"],[443,"Chairs",1,99,4,20,20,1,5,"8","2,16",""],[444,"Home Sweet Home",2,4,3,20,20,1,8,"5","10,15","62"],[445,"Pandemic: Hot Zone – Europe",2,4,2,30,30,2,8,"3,10","43","3,40,62,118"],[446,"Seven Swords",2,2,2,60,60,3,14,"2","33","3,48,114,175"],[447,"Quest Stories",3,5,4,30,45,1,8,"8","31,36,44","1,131,153"],[448,"Bitoku",1,4,0,120,120,4,12,"1","31,51","140,180"],[449,"Los tesoros de Castellina",2,4,4,15,15,1,5,"9","2,16","93,140"],[450,"Ray Master",1,2,2,30,30,2,10,"7","1,48,63","3,62,179"],[451,"Candy Time",2,6,3,10,25,1,5,"9","16,64","160"],[452,"Covenant",3,5,0,20,45,0,10,"2","49","62,93"],[453,"Pescar Peces",1,4,3,5,5,1,2,"9","2,10,16,25,53","48,140"],[454,"Bellaflor",2,4,3,10,10,1,3,"9","16","133"],[455,"Omerta",3,5,3,20,0,1,10,"5","15,39","62,93,155"],[456,"Zombie Tsunami",3,6,5,25,35,1,10,"5","13,15,22,54,57,78,84","48,122,155,157,178"],[457,"¡Desplumados!",3,7,5,15,30,1,8,"10,3","10,15,57","155"],[458,"Macbeth",2,5,4,30,45,2,12,"8","23,36,44,55,57","48,122,155"],[459,"LIXO?",2,6,5,20,20,1,6,"9","15,16,25,27","13,62"],[460,"Ticket to Mars",2,5,0,15,20,1,8,"5","69","62,179"],[461,"Rory's Story Cubes: Rescue",1,99,0,10,10,0,6,"7","23","153"],[462,"CONEX",2,4,3,15,20,1,8,"7","1,15,23","48,79,110,160"],[463,"Rolit",2,4,2,30,30,1,7,"7","1","10"],[464,"Trappist One",2,4,0,45,60,3,12,"1","15,69,70","28,62,140"],[465,"Globe Twister",1,5,4,15,30,2,8,"5","29,64,76","4,110"],[466,"Dark Matter",2,4,4,15,45,3,8,"1","15,69,70","3,62"],[467,"Rory's Story Cubes: Explore",1,12,0,15,20,0,6,"7","23","40,48,153"],[468,"Back to the Future: An Adventure Through Time",2,4,3,30,30,2,10,"2","48","62"],[469,"StoryLine: Scary Tales",3,8,6,15,30,1,8,"9","15,16,31","142,153,178"],[470,"La Abeja Adela",1,4,0,5,10,1,2,"9","10,16,25","48"],[471,"Time's Up! Green Edition",4,12,0,30,30,1,12,"8","57","1,93,157"],[472,"Cortex + Challenge",2,6,0,10,15,1,8,"8","15,25,45,57","93,112"],[473,"Town of Salem: The Card Game",4,36,11,10,45,0,8,"8","13,15,22,39,78","178"],[474,"Flap Flap",2,4,0,20,20,1,5,"9","10,16,66","112"],[475,"Black Stories: Holiday Edition",2,15,6,45,45,1,14,"8","15,22,35,36,49,57","153"],[476,"Hexcalibur",2,2,2,20,50,2,10,"2","23,31,33,44,80","10,48,104,160,175"],[477,"Hatflings!",2,2,2,15,30,2,10,"5","1,31","10,61,160"],[478,"Vampir Mau Mau",2,4,3,20,30,1,8,"5","15","62"],[479,"Fast Flip",2,8,3,15,15,1,7,"8","66","112"],[480,"Rush Hour Shift",2,2,2,5,15,1,8,"7","","62"],[481,"Magic Mandala",2,4,3,10,15,1,6,"5","2,66","110"],[482,"Tortilla de Patatas: The Game",2,4,4,15,15,1,6,"5","15,45","62,93"],[483,"Arcanya: Magic Academy",3,10,6,20,30,1,6,"5","15,31","62"],[484,"Cortex Challenge GEO",2,6,0,15,30,1,9,"8","15,57",""],[485,"Little Fox",2,4,4,10,10,1,4,"9","10,16,23,43,78","48"],[486,"Black Stories: Mittelalter Edition",2,15,6,20,20,1,12,"8","15,22,35,36,44,49,57","153"],[487,"Crazy Clack!",2,6,3,10,10,1,4,"9","16,66","48,112"],[488,"Escape Pods",1,5,5,20,30,2,10,"2","65,69,70","3,61,93,114"],[489,"Penalties: Animal Cup",2,2,2,10,10,1,8,"5","15,22,72","29,62,141"],[490,"Predator: Partida de Caza",1,5,1,30,45,0,14,"2","15,23,48,69,80","48,122,139"],[491,"Tweegles",2,5,0,15,15,1,6,"9","15,16,66","1,112"],[492,"Populi Turolii",3,8,0,20,20,1,8,"5","15,44","62,175,178"],[493,"La Ruta del Tesoro",2,6,6,90,180,1,8,"5","24,54","133,140,163"],[494,"Bugs",3,6,6,30,30,1,10,"5","10,15","78"],[495,"El Monstruo de los Calcetines",2,6,4,10,10,1,4,"9","16","112,140"],[496,"Ajo y Agua",4,6,6,20,20,0,8,"5","13,15,22,36,49,55,69","62,131,157,175"],[497,"No Game Over",2,6,4,15,30,1,10,"5","33,36,78","48,62,116,155"],[498,"Black Stories: El Interrogatorio",3,6,0,15,20,0,12,"8","49","153"],[499,"¡Tocado, Encontrado!",2,4,0,5,10,1,3,"3,9","2,16,31","112"],[500,"Triominos Deluxe",1,6,4,20,20,0,6,"7","1","160"],[501,"Tangram",1,4,4,10,10,1,8,"7","64,66",""],[502,"Colorpop",1,5,2,10,20,1,8,"7","1,22,64","110"],[503,"Karibou Camp",3,7,5,20,20,1,8,"8","2,57","157"],[504,"En tu casa o donde sea",4,7,5,30,50,1,18,"8","15,36,41,57","62,131,155"],[505,"Baby Blues",3,5,0,30,30,1,8,"8","15,36","62,155"],[506,"Trivial Pursuit: The Big Bang Theory Edition",2,10,0,30,60,0,12,"5","48,57,77","48,93"],[507,"Adventure Time: Aventuras en el mundo de Ooo",1,5,3,60,90,2,8,"2","3,29,31,48","28,62,118,155,175"],[508,"Soplar el pastel",1,4,2,5,5,1,4,"9","2,16",""],[509,"Alquerque",2,2,2,10,20,2,8,"7","1","61"],[510,"Miau Miau",2,5,3,10,10,1,5,"9","15,16","28,112"],[511,"Tira al Cuervo",2,2,2,10,15,1,5,"9","10,16,22","48,137"],[512,"Conejito Burbuja",2,4,2,5,5,1,2,"9","16","112"],[513,"PRRRT...",3,7,6,15,15,1,8,"5","13,15",""],[514,"Doodle Dice",2,6,4,20,30,1,6,"5","15,23","48,140,155"],[515,"Jenga Quake",1,99,0,10,10,1,6,"7","2,26","144"],[516,"The Lord of the P.I.G.S.",2,4,4,30,30,0,16,"5","15,25,36,54,60","62,141,157,178"],[517,"Poc!",2,4,0,10,15,1,8,"5","2",""],[518,"Black Stories: Medizin Edition",2,15,6,45,45,1,14,"8","15,22,35,36,43,49,57","153"],[519,"Pamplona: Viva San Fermín!",2,4,4,45,45,3,8,"3,10","10,65","61,62,155,175"],[520,"Explorers of the Lost Valley",2,4,4,15,25,1,10,"5","10,15,23,29,33,61,62","28,48,122,140"],[521,"Guau, Guau, La Oreja Colgante",2,4,2,10,10,2,5,"9","10,15,16,36,45","62,93"],[522,"La Pandilla Hámster",1,4,2,10,0,1,4,"3,10","10,16,23","40,114,133,161"],[523,"Forest",2,5,4,15,15,1,6,"5","15","140"],[524,"Fruit Ninja: Combo Party",3,6,5,20,40,1,8,"8","2,15,28,57","28,112,122"],[525,"Alcatraz",2,4,2,30,30,2,10,"7","1",""],[526,"\"La Garde recule!\"",1,2,1,60,60,2,10,"4","52,80","63"],[527,"Cards Against Downtime",3,99,5,45,45,1,17,"8","15,36,57,63","28"],[528,"Quizoo",2,8,0,15,15,0,6,"5","10,45","93"],[529,"Café Race",3,6,0,15,15,1,8,"3,10","63,65","13,48,142"],[530,"Rick and Morty: Tráfico de Megasemillas",2,5,3,15,30,0,12,"3,10","15,20,36","62,140"],[531,"Junior Cluedo",2,6,0,20,20,0,12,"5","45,49","93,95"],[532,"Fantasía S.A.",2,5,3,20,20,1,12,"3,10","3,15,23,31,33,36","131,175"],[533,"Taki",2,10,4,30,30,1,6,"5","15,56",""],[534,"Party & Co",3,20,4,45,45,1,14,"8","57","108,131,143,153,157"],[535,"Party & Co: Junior",2,4,0,35,35,1,6,"9","16,40,45,57","40,81,93,131,133,143"],[536,"¿Por qué no te callas? (Taggle)",3,6,6,20,20,1,14,"3,10","15,41,57","178"],[537,"Guatafac",3,12,0,15,60,1,18,"8","15,36,57",""],[538,"El Palé",2,6,3,60,60,0,9,"3,10","24","13,28,48,133"],[539,"El último banquete (The Last Banquet)",6,25,11,45,45,2,10,"8,3","13,31,36,44,57","1,131,153,157,175"],[540,"Trivial Pursuit: Family Edition",2,36,4,90,90,1,12,"9","16,57,77","133"],[541,"Operation",2,4,0,15,15,1,4,"9","2,16,43",""],[542,"Donkey Kong",2,4,4,20,20,1,7,"9","16,78","118,133"],[543,"Crisis: Tokyo",2,5,4,60,60,1,14,"2","15","62"],[544,"Yo Fui a EGB: El Juego Oficial",2,6,6,60,180,1,12,"5","25,57,77","48,133"],[545,"¡Camarero!",3,6,6,15,15,1,8,"10,3","15,24,45","93"],[546,"Preguntas de Mierda",2,24,8,20,20,1,18,"8","15,41,57","178"],[547,"Risk",2,6,4,120,120,2,10,"4","73,80","11,48,116,140"],[548,"Monos Locos",2,4,3,15,15,1,5,"9","2,16","48,113"],[549,"Pictureka!",2,7,4,30,30,1,6,"5","1,45,57,64","13,93,95"],[550,"Kabaleo",2,4,2,15,15,1,8,"7","1,13,22","160"],[551,"Dominoes",2,10,4,30,30,1,5,"7","1,34,78","110,112,157,160"],[552,"Conan: el juego de cartas",2,4,3,30,30,1,13,"2","15,31",""],[553,"Jenga: Tetris",1,99,0,20,20,1,8,"7","2,57,78","122"],[554,"The Game of Life Junior",2,4,4,15,30,1,5,"9","16","133"],[555,"Alguien ha probado este juego?",2,10,5,1,10,1,12,"8","15,36,57","62,93,116,130,155"],[556,"Monopoly Tramposo",2,6,4,60,180,1,8,"5","24","133,140,163"],[557,"DogFight WW1",2,2,2,30,30,1,8,"2","12,15,33,80,82","62,137"],[558,"The Hobbit Card Game",2,5,5,30,30,1,10,"5","15,31,55","62,116,165"],[559,"Cthulhu Dice",2,6,0,5,5,1,10,"8","23,35,36,57","48,116"],[560,"Trivial Pursuit: Genus Edition",2,24,4,90,90,1,12,"5","57,77","133,140"],[561,"El Ahorcado (Hangman)",2,2,2,10,10,1,6,"5","22,81",""],[562,"Damas (Checkers)",2,2,2,30,30,1,6,"7","1,21","61,111,148,151"],[563,"Guess Who?",2,2,2,20,20,1,6,"9","16,22,48","46"],[564,"The Game of Life",2,6,4,60,60,1,8,"5","16,24,26","133,141"],[565,"Monopoly",2,8,4,60,180,1,8,"5","24,54","13,48,71,83,84,107,116,133,140,152,162,163"],[566,"Catan: 5-6 Player Extension",5,6,5,120,120,2,10,"5","28,54","48,62,93,95,104,163"],[567,"Carcassonne: Expansion 1 – Inns & Cathedrals",2,6,2,60,60,2,8,"3,5","17,28,44,73","10,160"],[568,"Carcassonne: Expansion 2 – Traders & Builders",2,6,2,60,60,2,13,"5,1,3","17,28,44,73","10,140,160"],[569,"Picar?",2,4,2,4,3,1,5,"2","8","9"],[570,"Monopoly : Money Heist Edition",2,4,4,1,2,1,5,"9","36","17"],[571,"BANG! The Bullet!",3,8,6,20,40,2,8,"8","8,13,15,22,33,36","62,65,116,155,157,175"],[572,"Dixit: Origins",3,6,5,30,30,1,8,"8","13,15,28,36,57","142,153,178"],[573,"Carcassonne: Expansion 4 – The Tower",2,6,3,60,60,2,8,"3,1,5","17,28,44,73","10,160"],[574,"Black Stories: Scary Music Edition",2,99,0,2,222,0,12,"8","15,22,35,36,49,57","153"],[575,"Black Stories Junior: Purple Stories",2,15,0,2,222,1,8,"8","16,22,31,57","153"],[576,"Black Stories: Uni Edition",2,99,0,2,222,0,12,"8","15,22,35,49,57","153"],[577,"Black Stories: Science-Fiction Edition",0,0,0,0,0,0,3,"8","",""],[578,"Black Stories: Office Edition",0,0,0,0,0,0,3,"8","",""],[579,"Carcassonne: 20th Anniversary Edition",0,0,0,0,0,0,3,"5","",""],[580,"Carcassonne: Expansion 3 – The Princess & The Dragon",0,0,0,0,0,0,3,"","",""],[581,"Carcassonne: Expansion 8 – Bridges, Castles and Bazaars",0,0,0,0,0,0,3,"","",""],[582,"Carcassonne: Expansion 5 – Abbey & Mayor",0,0,0,0,0,0,3,"","",""],[583,"Cards Against Humanity: Green Box",0,0,0,0,0,0,3,"8","",""],[584,"Dobble: Star Wars",0,0,0,0,0,0,3,"5","",""],[585,"Dobble Star Wars: Mandalorian",0,0,0,0,0,0,3,"5","",""]];

const TYPE_NAMES = {1:"Estrategia",2:"Abstracto",3:"Familiar",4:"Wargames",5:"Party / Fiesta",7:"Temático",8:"Infantil",9:"Cooperativo",10:"Filler"};
const CAT_NAMES = {1:"Aventura",2:"Exploración",3:"Deducción",6:"Rol",8:"Fantasía",9:"Antiguo",10:"De dados",11:"Terror",12:"Ciencia ficción",13:"De cartas",15:"De cartas",16:"Gestión de mano",17:"Económico",18:"Medieval",19:"Civilización",20:"Construcción",21:"Destreza",22:"Humor",23:"Territorial",24:"Civilización",25:"Puzle",26:"Cooperativo",27:"Legacy",28:"Exploración",29:"Misterio",31:"Fantasía",32:"Comercio",33:"Miniaturas",34:"Piratas",35:"Dados",36:"Deducción",37:"Ciencia ficción",39:"Animales",40:"Lucha",41:"Coleccionable",42:"Viajes",43:"Médico",44:"Medieval",45:"Construcción ciudades",46:"Espionaje",47:"Político",48:"Puzzles",49:"Mitología",50:"Trenes",51:"Náutico",52:"Carreras",53:"Zombis",54:"Palabras",55:"Trivia",56:"Memoria",57:"De fiesta",59:"Adivinanzas",60:"Guerra moderna",61:"Historia",62:"Familiar",63:"Abstracto",64:"Negociación",65:"Habilidad",66:"Educativo",67:"Musical",68:"Deportes",69:"Temático",70:"Industria",71:"Agricultura",72:"Cocina",73:"Renacimiento",74:"Vikingos",75:"Asia",76:"Egipto",77:"Gatuno",78:"Dragones",80:"Guerra fría",81:"2ª Guerra Mundial",82:"1ª Guerra Mundial",83:"Americano",84:"Zombis"};
const MECH_NAMES = {1:"Tirada de dados",3:"Gestión de acciones",5:"Subastas",7:"Faroleo",8:"Apuestas",9:"Movimiento",10:"Campaña",11:"Reclutamiento",13:"Gestion de cartas",15:"Combos",16:"Comunicación",17:"Contratos",19:"Cooperativo",20:"Mayorías",21:"Coste de acciones",22:"Crucigramas",23:"Colocación de dados",24:"Construcción de mazos",25:"Borrador de cartas",26:"Eliminación",27:"Área de influencia",28:"Drafting",29:"Rapidez",30:"Destreza",31:"Escritura",32:"Apilamiento",33:"Colocación de losetas",35:"Emparejar",36:"Simultáneo",37:"Puntos final",38:"Equipos",39:"Roles ocultos",40:"Cooperativo",44:"Bloqueo",45:"Identidades ocultas",46:"Mapa modular",47:"Movimiento cuadrícula",48:"Gestión de mano",49:"Hexagonal",51:"Rondas",52:"Legado",53:"Intercambio",54:"Colocación obreros",55:"Selección de acciones",56:"Subasta",57:"Mapa",58:"Roles especiales",60:"Tirar y mover",61:"Colocación losetas",62:"Colección de conjuntos",63:"Puntos de victoria",64:"Storytelling",65:"Votación",66:"Producción",68:"Poder de veto",71:"Recursos variables",72:"Influencia",74:"Memoria",75:"Negociación",76:"Cartas de objetivo",77:"Toma de riesgos",78:"Descarte",79:"Capas",80:"Movimiento de peones",81:"Programación",82:"Construcción de rutas",83:"Patrones",84:"Carreras",85:"Preguntas",86:"Lectura labios",87:"Poderes asimétricos",88:"Adivinanzas",89:"Reconocimiento",91:"Agilidad",92:"Tiempo real",93:"Elección múltiple",95:"Tira y afloja",96:"Solitario",98:"Control zona",102:"Tokens",103:"Sigilo",104:"Tracks",105:"Puzle",106:"Trading",107:"Venta",108:"Mapas",110:"Mercado",111:"Escenarios",112:"Eventos",113:"Narrativo",114:"Misiones",115:"Supervivencia",116:"Tech tree",117:"Tablero personal",118:"Turno variable",119:"Fichas",120:"Bolsa",121:"Bonificaciones",122:"Puntuación por áreas",123:"Modificadores",124:"Multiplicadores",126:"Movimiento secreto",127:"Piedra-papel-tijeras",128:"Asimetría",129:"Apuestas ciegas",130:"Persuasión",131:"Multiusos",132:"Pactos",133:"Fase variable",134:"Crecimiento",135:"Combinación",136:"Alianzas",137:"Objetivos ocultos",138:"Exploración",139:"Revelación",140:"Fin de partida variable",141:"Cartas de evento",142:"Orden de turno variable",143:"Prueba de habilidad",144:"Acumulación",145:"Intercambio forzado",146:"Income",147:"Tablero oculto",148:"Derrota cooperativa",149:"Bloqueo de acciones",150:"Límite de mano",151:"Entrega",152:"Reserva de acciones",153:"Selección simultánea",154:"Final de muerte súbita",155:"Paso de cartas",156:"Cadena de acciones",157:"Movimiento en área",158:"Poder especial",159:"Resolución de combate",160:"Mercado abierto",161:"Apuesta progresiva",162:"Resultado aleatorio",163:"Cartas multifunción",164:"Pago de recursos",165:"Traición",166:"Tira y afloja",168:"Protección",169:"Ingresos",170:"Rondas fijas",172:"Coste variable",173:"Red de conexiones",174:"Acciones limitadas",175:"Turnos",176:"Conexiones",177:"Habilidad especial",178:"Expansión territorial",179:"Mazo compartido",180:"Despliegue",181:"Preparación"};


const DIFF_LABELS = ["", "Muy fácil", "Fácil", "Media", "Difícil", "Muy difícil"];
const DIFF_COLORS = ["", "#7CB342", "#7CB342", "#FFD60A", "#FF9800", "#FF6B6B"];

function GameModal({ game, onClose }) {
  const [activeTab, setActiveTab] = useState('desc');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!game) return;
    setDetail(null);
    setActiveTab('desc');
    api.games.getById(game.id).then(data => { if (data) setDetail(data); });
  }, [game?.id]);

  if (!game) return null;

  // Merge: detail (full DB fetch) overrides the basic game object from list/chat
  const d = detail ? { ...game, ...detail } : game;
  const durText = d.durationMin === d.durationMax ? `${d.durationMin} min` : `${d.durationMin}-${d.durationMax} min`;
  const playText = d.playersMin === d.playersMax ? `${d.playersMin}` : `${d.playersMin}-${d.playersMax}`;
  const typeList = d.types || [];
  const catList = d.categories || [];
  const mechList = d.mechanics || [];

  return (
    <div className="gmodal-overlay" onClick={onClose}>
      <div className="gmodal" onClick={e => e.stopPropagation()}>
        <button className="gmodal-close" onClick={onClose}>×</button>
        <div className="gmodal-grid">
          <div className="gmodal-img">
            {d.imageUrl ? (
              <img src={d.imageUrl} alt={d.name} style={{width:"100%",height:"auto",borderRadius:16,display:"block"}} />
            ) : (
              <div style={{height:280,background:"linear-gradient(135deg,#8B5E3C,#E8A33C,#FFD60A)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,.9)",fontFamily:"'Lilita One',sans-serif",fontSize:"1.1rem",padding:"1rem",textAlign:"center"}}>{d.name}</div>
            )}
          </div>
          <div className="gmodal-info">
            <h2>{d.name}</h2>

            {typeList.length > 0 && <div className="gmodal-tagrow"><span className="gmodal-taglabel">Tipos:</span>{typeList.map(t => <span key={t.id} className="gtag tipo">{t.name}</span>)}</div>}
            {catList.length > 0 && <div className="gmodal-tagrow"><span className="gmodal-taglabel">Categorías:</span>{catList.map(c => <span key={c.id} className="gtag cat">{c.name}</span>)}</div>}

            <div className="gmodal-diff">
              <span className="gdot" style={{ background: DIFF_COLORS[d.difficulty] || "#999" }} />
              <span>Dificultad: {d.difficulty}/5 — {DIFF_LABELS[d.difficulty] || "—"}</span>
            </div>

            <div className="gmodal-stats">
              <div className="gstat">{I.clock(20, "#2D2D2D")}<div><small>Duración</small><strong>{durText}</strong></div></div>
              <div className="gstat">{I.people(20, "#2D2D2D")}<div><small>Jugadores</small><strong>{playText}</strong></div></div>
              <div className="gstat">{I.star(20, "#2D2D2D")}<div><small>Mejor para</small><strong>{d.playersBest || "—"}</strong></div></div>
              <div className="gstat">{I.dice(20, "#2D2D2D")}<div><small>Edad</small><strong>{d.ageMin}+</strong></div></div>
            </div>

            {detail && (detail.description || detail.gameplay) && (
              <div>
                <div className="gmodal-tab-btns">
                  {detail.description && <button className={`gmodal-tab-btn${activeTab==='desc'?' active':''}`} onClick={() => setActiveTab('desc')}>Descripción</button>}
                  {detail.gameplay && <button className={`gmodal-tab-btn${activeTab==='play'?' active':''}`} onClick={() => setActiveTab('play')}>Jugabilidad</button>}
                </div>
                <div className="gmodal-tab-content">
                  {activeTab === 'desc' && detail.description && <p className="gmodal-desc">{detail.description}</p>}
                  {activeTab === 'play' && detail.gameplay && <p className="gmodal-desc">{detail.gameplay}</p>}
                </div>
              </div>
            )}

            {mechList.length > 0 && <div className="gmodal-tagrow"><span className="gmodal-taglabel">Mecánicas:</span>{mechList.map(m => <span key={m.id} className="gtag mech">{m.name}</span>)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PJuegos() {
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState(0);
  const [maxDiff, setMaxDiff] = useState(5);
  const [maxDur, setMaxDur] = useState(240);
  const [typeFilter, setTypeFilter] = useState(0);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [games, setGames] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState([]);

  useEffect(() => {
    api.games.getTypes().then(data => { if (data) setTypes(data); });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 24 };
    if (search) params.search = search;
    if (typeFilter) params.typeId = typeFilter;
    if (players) params.players = players;
    if (maxDiff < 5) params.maxDifficulty = maxDiff;
    if (maxDur < 240) params.maxDuration = maxDur;
    api.games.search(params).then(data => {
      if (data) { setGames(data.games); setPagination(data.pagination); }
      setLoading(false);
    });
  }, [search, typeFilter, players, maxDiff, maxDur, page]);

  const resetFilters = () => { setSearch(""); setPlayers(0); setMaxDiff(5); setMaxDur(240); setTypeFilter(0); setPage(1); };

  return (<>
    <div className="ph"><h1>Nuestros Juegos</h1><p>¡Una colección de {pagination.total || "500+"} juegos!</p></div>
    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn">
        <div className="jbrowser">
          {/* SIDEBAR */}
          <aside className="jside">
            <div className="jside-head">
              <h3>Filtros</h3>
              <button className="jreset" onClick={resetFilters}>Limpiar</button>
            </div>

            <div className="jfield">
              <label>Buscar por nombre</label>
              <input type="text" placeholder="Escribe un nombre..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>

            <div className="jfield">
              <label>Jugadores: {players === 0 ? "Todos" : players}</label>
              <input type="range" min="0" max="10" value={players} onChange={e => { setPlayers(+e.target.value); setPage(1); }} />
              <div className="jrange-labels"><span>Todos</span><span>10</span></div>
            </div>

            <div className="jfield">
              <label>Dificultad máx: {DIFF_LABELS[maxDiff] || maxDiff}</label>
              <input type="range" min="0" max="5" value={maxDiff} onChange={e => { setMaxDiff(+e.target.value); setPage(1); }} />
              <div className="jrange-labels"><span>0</span><span>5</span></div>
            </div>

            <div className="jfield">
              <label>Duración máx: {maxDur >= 240 ? "Sin límite" : maxDur + " min"}</label>
              <input type="range" min="10" max="240" step="10" value={maxDur} onChange={e => { setMaxDur(+e.target.value); setPage(1); }} />
              <div className="jrange-labels"><span>10 min</span><span>4h+</span></div>
            </div>

            <div className="jfield">
              <label>Tipo de juego</label>
              <div className="jtype-grid">
                <button className={`jtype-btn ${typeFilter===0?"on":""}`} onClick={() => {setTypeFilter(0);setPage(1);}}>Todos</button>
                {types.map(t => (
                  <button key={t.id} className={`jtype-btn ${typeFilter===t.id?"on":""}`} onClick={() => {setTypeFilter(t.id);setPage(1);}}>{t.name}</button>
                ))}
              </div>
            </div>

            <div className="jcount">{loading ? "Buscando..." : `${pagination.total} juegos encontrados`}</div>
          </aside>

          {/* GRID */}
          <div className="jmain">
            {loading && <div style={{ textAlign: "center", padding: "2rem", color: "var(--tm)" }}>Cargando juegos...</div>}
            {!loading && games.length === 0 && <div style={{ textAlign: "center", padding: "3rem", color: "var(--tm)" }}><p style={{ fontFamily: "'Lilita One',sans-serif", fontSize: "1.3rem", marginBottom: ".5rem" }}>No hay juegos con esos filtros</p><p style={{ fontWeight: 600 }}>Prueba a cambiar los filtros o limpiar la búsqueda</p></div>}
            <div className="jgrid">
              {games.map(g => {
                const durText = g.durationMin === g.durationMax ? `${g.durationMin}` : `${g.durationMin}-${g.durationMax}`;
                const playText = g.playersMin === g.playersMax ? `${g.playersMin}` : `${g.playersMin}-${g.playersMax}`;
                return (
                  <div className="jcard" key={g.id} onClick={() => setSelected(g)}>
                    {g.imageUrl ? (
                      <img src={g.imageUrl} alt={g.name} style={{width:"100%",height:120,objectFit:"cover",display:"block"}} />
                    ) : (
                      <div style={{width:"100%",height:120,background:"linear-gradient(135deg,#8B5E3C,#E8A33C,#FFD60A)",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,.85)",fontFamily:"'Lilita One',sans-serif",fontSize:".8rem",padding:".5rem",textAlign:"center"}}>{g.name}</div>
                    )}
                    <div className="jcard-body">
                      <div className="jcard-diff"><span className="gdot" style={{ background: DIFF_COLORS[g.difficulty] || "#ccc" }} /></div>
                      <h4>{g.name}</h4>
                      <div className="jcard-meta">
                        <span>{I.clock(13, "#4A4A60")} {durText}'</span>
                        <span>{I.people(13, "#4A4A60")} {playText}</span>
                        <span>{I.star(13, "#4A4A60")} {g.ageMin}+</span>
                      </div>
                    </div>
                    <div className="jcard-cta">Ver detalles</div>
                  </div>
                );
              })}
            </div>

            {/* PAGINATION */}
            {pagination.totalPages > 1 && (
              <div className="jpag">
                <button className="jpag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
                <span className="jpag-info">Página {page} de {pagination.totalPages}</span>
                <button className="jpag-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>

    <GameModal game={selected} onClose={() => setSelected(null)} />
  </>);
}


function MenuItem({ item }) {
  return (
    <div className="mi">
      <div>
        <h4>{item.vegan && <span className="vbadge" title="Opción disponible" />}{item.name}</h4>
        {item.desc && <div className="d">{item.desc}</div>}
      </div>
      <div className="mp">{item.price}</div>
    </div>
  );
}

function PCarta() {
  const cats = [
    { key: "entrantes", label: "Entrantes", icon: I.burger(26) },
    { key: "burgers", label: "Burgers", icon: I.burger(26), note: "Todas acompañadas con patatas fritas" },
    { key: "hotdogs", label: "Hotdogs", icon: I.hotdog(26) },
    { key: "bebidas", label: "Bebidas Frías", icon: I.coffee(26) },
    { key: "cervezas", label: "Cervezas & Vinos", icon: I.beer(26) },
    { key: "especiales", label: "Bebidas Especiales", icon: I.bottle(26), note: "Bunker Cola, Bunker Cherry & Estus Flask" },
    { key: "postres", label: "Postres", icon: I.cake(26) },
  ];
  return (<>
    <div className="ph"><h1>Nuestra Carta</h1><p>¡Disfruta de unos deliciosos platos!</p></div>
    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn">
        {/* Cover info */}
        <div style={{ background: "var(--black)", borderRadius: "var(--r)", padding: "1.2rem 2rem", color: "var(--yellow)", fontFamily: "'Lilita One',sans-serif", textAlign: "center", marginBottom: "3rem", fontSize: "1.1rem" }}>
          ¡Ven a comer... quédate a jugar! — Cover juegos: 3,50 € / persona
        </div>

        {cats.map(cat => (
          <div className="mcat" key={cat.key}>
            <div className="mchead">{cat.icon}<h3>{cat.label}</h3></div>
            {cat.note && <p style={{ color: "var(--tm)", fontWeight: 600, fontSize: ".9rem", marginTop: "-1rem", marginBottom: "1rem", fontStyle: "italic" }}>{cat.note}</p>}
            <div className="mgrid">{MENU[cat.key].map((item, i) => <MenuItem key={i} item={item} />)}</div>
          </div>
        ))}

        {/* Extras */}
        <div style={{ background: "var(--white)", borderRadius: "var(--rl)", padding: "2rem", boxShadow: "var(--sh)", marginTop: "2rem", borderLeft: "6px solid var(--yellow)" }}>
          <h3 style={{ fontFamily: "'Lilita One',sans-serif", color: "var(--black)", fontSize: "1.2rem", marginBottom: ".8rem" }}>Personaliza tu plato</h3>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div><strong style={{ color: "var(--coral)", fontFamily: "'Lilita One',sans-serif" }}>+1 €</strong><p style={{ color: "var(--tm)", fontSize: ".85rem", fontWeight: 600, marginTop: ".3rem" }}>Cheddar · Bacon · Jalapeños · Salsa Ajonesa · Salsa Picante · Salsa Miel y Mostaza · Salsa BBQ</p></div>
            <div><strong style={{ color: "var(--coral)", fontFamily: "'Lilita One',sans-serif" }}>+2 €</strong><p style={{ color: "var(--tm)", fontSize: ".85rem", fontWeight: 600, marginTop: ".3rem" }}>Heura · Guacamole · Cebolla Caramelizada · Queso de Cabra</p></div>
          </div>
        </div>
      </div>
    </section>
  </>);
}

function PPreguntas({ setPage }) {
  const [oi, setOi] = useState(null);
  const go = p => { setPage(p); window.scrollTo(0, 0); };
  return (<>
    <div className="ph"><h1>Preguntas & Cómo Funciona</h1><p>Todo lo que necesitas saber sobre El Búnker</p></div>
    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn">
        <h2 className="stitle">Tu experiencia <span className="yl">paso a paso</span></h2>
        <p className="ssub">Así de fácil es pasarlo genial en El Búnker</p>
        {/* IMAGE PLACEHOLDER — Reemplaza src con tu imagen PNG */}
        <div className="exp-img-placeholder">
          <div className="exp-img-inner">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="4" y="10" width="56" height="40" rx="6" stroke="#FFD60A" strokeWidth="3" fill="none"/><circle cx="22" cy="28" r="7" stroke="#FFD60A" strokeWidth="2.5" fill="none"/><path d="M4 42l14-10 10 7 14-12 18 13" stroke="#FFD60A" strokeWidth="2.5" fill="none"/><circle cx="44" cy="20" r="4" fill="#FFD60A" opacity=".4"/></svg>
            <p>Aquí va tu imagen de experiencia paso a paso (PNG)</p>
            <span>Sube la imagen y reemplaza este placeholder</span>
          </div>
        </div>
      </div>
    </section>
    <section className="sec" style={{ background: "var(--white)" }}>
      <div className="ctn">
        <h2 className="stitle">Preguntas <span className="yl">frecuentes</span></h2>
        <p className="ssub">Si tienes más dudas, escríbenos sin problema</p>
        <div className="flist">{FAQ.map((f, i) => <div className={`fi ${oi === i ? "op" : ""}`} key={i}><button className="fq" onClick={() => setOi(oi === i ? null : i)}>{f.q}<span className={`ftog ${oi === i ? "op" : ""}`}>+</span></button>{oi === i && <div className="fa">{f.a}</div>}</div>)}</div>
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}><button className="btn btn-dark" onClick={() => go("contacto")}>Escríbenos</button></div>
      </div>
    </section>
  </>);
}

// ============================================================
// RESERVATION SYSTEM WITH INTERACTIVE FLOOR PLAN
// ============================================================

// Tables have x,y (%) position on a 2D map. adj = tables physically next to (left/right/front)
// Shape: "round" | "rect" | "long". w,h = size in % of container
const FLOOR = {
  principal: {
    name: "Zona Principal", w: 720, h: 520,
    furniture: [
      { type:"bar", x:10, y:2, w:200, h:50, label:"BARRA" },
      { type:"shelf", x:430, y:2, w:270, h:45, label:"ESTANTERÍA JUEGOS" },
      { type:"door", x:310, y:475, w:100, h:40, label:"ENTRADA" },
      { type:"kitchen", x:10, y:470, w:130, h:40, label:"COCINA" },
    ],
    tables: [
      { id:"B1", seats:3, x:50,  y:85,  w:70, h:55, shape:"round", label:"Barra 1", adj:["B2"] },
      { id:"B2", seats:3, x:150, y:85,  w:70, h:55, shape:"round", label:"Barra 2", adj:["B1"] },
      { id:"M1", seats:4, x:300, y:120, w:80, h:65, shape:"rect", label:"Mesa 1", adj:["M2","M4"] },
      { id:"M2", seats:4, x:420, y:120, w:80, h:65, shape:"rect", label:"Mesa 2", adj:["M1","M3","M5"] },
      { id:"M3", seats:4, x:540, y:120, w:80, h:65, shape:"rect", label:"Mesa 3", adj:["M2","M6"] },
      { id:"M4", seats:4, x:300, y:250, w:80, h:65, shape:"rect", label:"Mesa 4", adj:["M1","M5","M7"] },
      { id:"M5", seats:4, x:420, y:250, w:80, h:65, shape:"rect", label:"Mesa 5", adj:["M2","M4","M6","M8"] },
      { id:"M6", seats:6, x:540, y:250, w:90, h:65, shape:"rect", label:"Mesa 6", adj:["M3","M5","M9"] },
      { id:"M7", seats:4, x:300, y:380, w:80, h:65, shape:"rect", label:"Mesa 7", adj:["M4","M8"] },
      { id:"M8", seats:4, x:420, y:380, w:80, h:65, shape:"rect", label:"Mesa 8", adj:["M5","M7","M9"] },
      { id:"M9", seats:6, x:560, y:380, w:90, h:65, shape:"rect", label:"Mesa 9", adj:["M6","M8"] },
    ],
  },
  sillones: {
    name: "Zona Sillones", w: 400, h: 480,
    furniture: [
      { type:"shelf", x:10, y:2, w:380, h:40, label:"ESTANTERÍA JUEGOS" },
    ],
    tables: [
      { id:"S1", seats:6, x:20,  y:340, w:100, h:70, shape:"long", label:"Sillón 1", adj:["S2"] },
      { id:"S2", seats:6, x:150, y:340, w:100, h:70, shape:"long", label:"Sillón 2", adj:["S1","S7"] },
      { id:"S3", seats:4, x:20,  y:70,  w:90,  h:65, shape:"rect", label:"Sillón 3", adj:["S4","S5"] },
      { id:"S4", seats:4, x:150, y:70,  w:90,  h:65, shape:"rect", label:"Sillón 4", adj:["S3"] },
      { id:"S5", seats:4, x:20,  y:160, w:90,  h:65, shape:"rect", label:"Sillón 5", adj:["S3","S6"] },
      { id:"S6", seats:4, x:20,  y:250, w:90,  h:65, shape:"rect", label:"Sillón 6", adj:["S5","S7"] },
      { id:"S7", seats:4, x:150, y:250, w:90,  h:65, shape:"rect", label:"Sillón 7", adj:["S6","S2"] },
    ],
  },
  terraza: {
    name: "Terraza", w: 600, h: 300,
    furniture: [
      { type:"plant", x:10,  y:10, w:60, h:40, label:"🌿" },
      { type:"plant", x:530, y:10, w:60, h:40, label:"🌿" },
      { type:"plant", x:10,  y:240, w:60, h:40, label:"🌿" },
      { type:"plant", x:530, y:240, w:60, h:40, label:"🌿" },
    ],
    tables: [
      { id:"T10", seats:4, x:80,  y:60,  w:90, h:65, shape:"rect", label:"Mesa 10", adj:["T11"] },
      { id:"T11", seats:4, x:200, y:60,  w:90, h:65, shape:"rect", label:"Mesa 11", adj:["T10","T12"] },
      { id:"T12", seats:4, x:320, y:60,  w:90, h:65, shape:"rect", label:"Mesa 12", adj:["T11","T13"] },
      { id:"T13", seats:4, x:440, y:60,  w:90, h:65, shape:"rect", label:"Mesa 13", adj:["T12"] },
      { id:"T14", seats:4, x:140, y:180, w:90, h:65, shape:"rect", label:"Mesa 14", adj:["T15"] },
      { id:"T15", seats:4, x:320, y:180, w:90, h:65, shape:"rect", label:"Mesa 15", adj:["T14"] },
    ],
  },
};

const HOURS = ["12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

// Mock reservations for 11/09/2026
const MOCK_RES = [
  // 12:00
  { date:"2026-09-11", hour:"12:00", zone:"principal", tableId:"B1", name:"García" },
  { date:"2026-09-11", hour:"12:00", zone:"principal", tableId:"M1", name:"López" },
  { date:"2026-09-11", hour:"12:00", zone:"principal", tableId:"M6", name:"Martínez" },
  { date:"2026-09-11", hour:"12:00", zone:"terraza", tableId:"T10", name:"Fernández" },
  { date:"2026-09-11", hour:"12:00", zone:"terraza", tableId:"T12", name:"Rodríguez" },
  // 13:00 — zona principal casi llena
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"B1", name:"Sánchez" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"B2", name:"Díaz" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M1", name:"Hernández" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M2", name:"Muñoz" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M3", name:"Álvarez" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M4", name:"Romero" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M5", name:"Torres" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M6", name:"Navarro" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M7", name:"Soler" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M8", name:"Ruiz" },
  { date:"2026-09-11", hour:"13:00", zone:"principal", tableId:"M9", name:"Gil" },
  { date:"2026-09-11", hour:"13:00", zone:"sillones", tableId:"S1", name:"Jiménez" },
  { date:"2026-09-11", hour:"13:00", zone:"sillones", tableId:"S2", name:"Cumple Ana" },
  { date:"2026-09-11", hour:"13:00", zone:"terraza", tableId:"T10", name:"Moreno" },
  { date:"2026-09-11", hour:"13:00", zone:"terraza", tableId:"T11", name:"Serrano" },
  { date:"2026-09-11", hour:"13:00", zone:"terraza", tableId:"T13", name:"Domínguez" },
  { date:"2026-09-11", hour:"13:00", zone:"terraza", tableId:"T14", name:"Vega" },
  // 14:00
  { date:"2026-09-11", hour:"14:00", zone:"principal", tableId:"M3", name:"Gil" },
  { date:"2026-09-11", hour:"14:00", zone:"principal", tableId:"M9", name:"Afterwork" },
  { date:"2026-09-11", hour:"14:00", zone:"sillones", tableId:"S3", name:"Cumple Pedro" },
  { date:"2026-09-11", hour:"14:00", zone:"sillones", tableId:"S4", name:"Reunión" },
  // 17:00
  { date:"2026-09-11", hour:"17:00", zone:"principal", tableId:"B1", name:"Vega" },
  { date:"2026-09-11", hour:"17:00", zone:"principal", tableId:"M6", name:"Castro" },
  { date:"2026-09-11", hour:"17:00", zone:"sillones", tableId:"S2", name:"Evento corp." },
  { date:"2026-09-11", hour:"17:00", zone:"sillones", tableId:"S1", name:"Cumple Lucía" },
  // 18:00
  { date:"2026-09-11", hour:"18:00", zone:"principal", tableId:"B1", name:"Ortiz" },
  { date:"2026-09-11", hour:"18:00", zone:"principal", tableId:"B2", name:"Marín" },
  { date:"2026-09-11", hour:"18:00", zone:"principal", tableId:"M1", name:"Iglesias" },
  { date:"2026-09-11", hour:"18:00", zone:"principal", tableId:"M6", name:"Peña" },
  { date:"2026-09-11", hour:"18:00", zone:"terraza", tableId:"T15", name:"Reyes" },
  // 19:00
  { date:"2026-09-11", hour:"19:00", zone:"principal", tableId:"M4", name:"Blanco" },
  { date:"2026-09-11", hour:"19:00", zone:"principal", tableId:"M9", name:"Marcos" },
  // 20:00 — MUY lleno
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"B1", name:"Molina" },
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"B2", name:"Rubio" },
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"M1", name:"Delgado" },
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"M2", name:"Medina" },
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"M5", name:"Guerrero" },
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"M6", name:"Despedida" },
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"M8", name:"Fiesta" },
  { date:"2026-09-11", hour:"20:00", zone:"principal", tableId:"M9", name:"Santos" },
  { date:"2026-09-11", hour:"20:00", zone:"sillones", tableId:"S1", name:"Herrera" },
  { date:"2026-09-11", hour:"20:00", zone:"sillones", tableId:"S2", name:"Vargas" },
  { date:"2026-09-11", hour:"20:00", zone:"sillones", tableId:"S3", name:"Evento" },
  { date:"2026-09-11", hour:"20:00", zone:"sillones", tableId:"S5", name:"Prieto" },
  { date:"2026-09-11", hour:"20:00", zone:"sillones", tableId:"S6", name:"Ortega" },
  { date:"2026-09-11", hour:"20:00", zone:"terraza", tableId:"T10", name:"Ramos" },
  { date:"2026-09-11", hour:"20:00", zone:"terraza", tableId:"T11", name:"Suárez" },
  { date:"2026-09-11", hour:"20:00", zone:"terraza", tableId:"T12", name:"León" },
  { date:"2026-09-11", hour:"20:00", zone:"terraza", tableId:"T14", name:"Méndez" },
  { date:"2026-09-11", hour:"20:00", zone:"terraza", tableId:"T15", name:"Ramos" },
  // 21:00
  { date:"2026-09-11", hour:"21:00", zone:"principal", tableId:"M3", name:"Méndez" },
  { date:"2026-09-11", hour:"21:00", zone:"principal", tableId:"M7", name:"Prieto" },
  // 22:00
  { date:"2026-09-11", hour:"22:00", zone:"principal", tableId:"B1", name:"Carrasco" },
];

function getOccupied(date, hour, zone) {
  return MOCK_RES.filter(r => r.date === date && r.hour === hour && r.zone === zone).map(r => r.tableId);
}

function getHourStatus(date, hour, zone, people) {
  const floor = FLOOR[zone];
  if (!floor) return "neutral";
  const occ = getOccupied(date, hour, zone);
  if (occ.length === floor.tables.length) return "full";
  const free = floor.tables.filter(t => !occ.includes(t.id));
  if (free.some(t => t.seats >= people)) return "free";
  // Check combining adjacent free tables
  for (const t of free) {
    const adjFree = t.adj.filter(aId => free.some(ft => ft.id === aId));
    for (const aId of adjFree) {
      const at = free.find(ft => ft.id === aId);
      if (t.seats + at.seats >= people) return "combine";
    }
  }
  return "warn";
}

// ---- FLOOR PLAN (2D positioned, bird's-eye view) ----
function FloorPlan({ zone, date, hour, people, duration = 2, selected, onSelect, liveFloor }) {
  const floor = (liveFloor && liveFloor[zone]) || FLOOR[zone];
  const [occ, setOcc] = useState([]);
  useEffect(() => {
    if (!zone || !date || !hour) { setOcc([]); return; }
    api.zones.getAvailability(zone, date, hour, duration).then(data => {
      if (data) setOcc(data.tables.filter(t => t.isOccupied).map(t => t.code));
      else setOcc(getOccupied(date, hour, zone));
    });
  }, [zone, date, hour, duration]);

  if (!floor || !hour) return null;
  const numP = parseInt(people) || 0;
  const selTables = floor.tables.filter(t => selected.includes(t.id));
  const totalSel = selTables.reduce((s, t) => s + t.seats, 0);

  const handleClick = (table) => {
    if (occ.includes(table.id)) return;
    if (selected.includes(table.id)) {
      onSelect(selected.filter(id => id !== table.id));
    } else if (selected.length === 0) {
      onSelect([table.id]);
    } else {
      const isAdj = selected.some(sId => table.adj.includes(sId));
      if (isAdj) {
        onSelect([...selected, table.id]);
      } else {
        onSelect([table.id]);
      }
    }
  };

  const getState = (t) => {
    if (occ.includes(t.id)) return "occ";
    if (selected.includes(t.id)) return "sel";
    if (selected.length > 0 && totalSel < numP && selected.some(sId => t.adj.includes(sId))) return "cmb";
    return "free";
  };

  const enough = selected.length > 0 && totalSel >= numP;
  const scale = typeof window !== "undefined" && window.innerWidth < 700 ? Math.min(1, (window.innerWidth - 80) / floor.w) : 1;

  // Chair positions around a table
  const chairPositions = (seats, w, h) => {
    const chairs = [];
    const sz = 10;
    const pad = 4;
    if (seats <= 2) {
      chairs.push({ x: w/2 - sz/2, y: -sz - pad }); // top
      chairs.push({ x: w/2 - sz/2, y: h + pad }); // bottom
    } else if (seats <= 4) {
      chairs.push({ x: w/2 - sz/2, y: -sz - pad });
      chairs.push({ x: w/2 - sz/2, y: h + pad });
      chairs.push({ x: -sz - pad, y: h/2 - sz/2 });
      chairs.push({ x: w + pad, y: h/2 - sz/2 });
    } else {
      chairs.push({ x: w*0.25 - sz/2, y: -sz - pad });
      chairs.push({ x: w*0.75 - sz/2, y: -sz - pad });
      chairs.push({ x: w*0.25 - sz/2, y: h + pad });
      chairs.push({ x: w*0.75 - sz/2, y: h + pad });
      chairs.push({ x: -sz - pad, y: h*0.33 - sz/2 });
      chairs.push({ x: w + pad, y: h*0.33 - sz/2 });
      if (seats > 6) {
        chairs.push({ x: -sz - pad, y: h*0.66 - sz/2 });
        chairs.push({ x: w + pad, y: h*0.66 - sz/2 });
      }
    }
    return chairs.slice(0, seats);
  };

  const stateColors = {
    free: { bg: "#d5e8d4", border: "#82b366", chair: "#82b366", text: "#2d6a2e" },
    occ:  { bg: "#f8cecc", border: "#b85450", chair: "#e57373", text: "#8b1a1a" },
    sel:  { bg: "#FFE082", border: "#F9A825", chair: "#FFD60A", text: "#1A1A2E" },
    cmb:  { bg: "#BBDEFB", border: "#42A5F5", chair: "#64B5F6", text: "#0D47A1" },
  };

  return (
    <div className="fp2-wrapper">
      <div className="fp2-header">
        <h4>{floor.name} — {hour}</h4>
        <div className="fp2-legend">
          <span><span className="fp2-ldot" style={{background:"#d5e8d4",borderColor:"#82b366"}}/> Libre</span>
          <span><span className="fp2-ldot" style={{background:"#f8cecc",borderColor:"#b85450"}}/> Reservada</span>
          <span><span className="fp2-ldot" style={{background:"#FFE082",borderColor:"#F9A825"}}/> Tu selección</span>
          <span><span className="fp2-ldot" style={{background:"#BBDEFB",borderColor:"#42A5F5"}}/> Combinable</span>
        </div>
      </div>

      <div className="fp2-scroll">
        <div className="fp2-map" style={{ width: floor.w * scale, height: floor.h * scale, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {/* Background grid pattern */}
          <div className="fp2-grid-bg" />

          {/* Furniture / decoration */}
          {(floor.furniture || []).map((f, i) => (
            <div key={`f${i}`} className={`fp2-furniture fp2-${f.type}`} style={{ left: f.x, top: f.y, width: f.w, height: f.h }}>
              {f.label}
            </div>
          ))}

          {/* Tables */}
          {floor.tables.map(t => {
            const st = getState(t);
            const c = stateColors[st];
            const chairs = chairPositions(t.seats, t.w, t.h);
            return (
              <div key={t.id} className={`fp2-table fp2-t-${st}`} style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: c.bg, borderColor: c.border, borderRadius: t.shape === "round" ? "50%" : t.shape === "long" ? 10 : 6, cursor: st === "occ" ? "not-allowed" : "pointer" }} onClick={() => handleClick(t)}>
                {/* Chairs */}
                {chairs.map((ch, ci) => (
                  <div key={ci} className="fp2-chair" style={{ left: ch.x, top: ch.y, background: c.chair, borderColor: c.border }} />
                ))}
                {/* Label */}
                <div className="fp2-tlabel" style={{ color: c.text }}>
                  <div className="fp2-tid">{t.id}</div>
                  <div className="fp2-tseats">{t.seats}p</div>
                </div>
                {st === "occ" && <div className="fp2-reserved">RESERVADA</div>}
                {st === "cmb" && <div className="fp2-combine-tag">+ JUNTAR</div>}
                {st === "sel" && <div className="fp2-check">✓</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selection summary */}
      {selected.length > 0 && (
        <div className={`fp2-summary ${enough ? "fp2-ok" : "fp2-need"}`}>
          {enough ? (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#7CB342"/><path d="M7 12l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              <div>
                <strong>{selected.length > 1 ? `${selected.join(" + ")} combinadas` : selected[0]} — {totalSel} plazas</strong>
                <span>Perfecto para tu grupo de {numP} personas</span>
              </div>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#FF9800"/><path d="M12 7v6M12 16v1" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>
              <div>
                <strong>{totalSel} plazas seleccionadas — necesitas {numP}</strong>
                <span>Haz clic en una mesa adyacente azul para completar las plazas</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- HOUR GRID ----
function HourGrid2({ date, zone, people, selectedHour, duration = 2, onSelect }) {
  if (!date || !zone) return null;
  const numP = parseInt(people) || 0;

  // Closing hours per day of week (0=Sun,1=Mon,...,6=Sat)
  const closingHours = { 0:22, 1:23, 2:23, 3:23, 4:23, 5:24, 6:24 };
  const dow = date ? new Date(date + 'T12:00:00').getDay() : 1;
  const closing = closingHours[dow] ?? 23;

  return (
    <div className="hour-grid">
      <label style={{ fontFamily:"'Lilita One',sans-serif", color:"var(--black)", marginBottom:".5rem", display:"block", fontSize:".95rem" }}>Selecciona hora *</label>
      <div className="hg-slots">
        {HOURS.map(h => {
          const startH = parseInt(h);
          const endH = startH + duration;
          // Disable hours where reservation would go past closing time
          if (endH > closing) {
            return (
              <button key={h} className="hg-slot" disabled style={{ opacity:.3, cursor:'not-allowed' }}>
                <span className="hg-time">{h}</span>
                <span className="hg-dot" style={{background:'#ccc'}} />
              </button>
            );
          }
          const st = numP > 0 ? getHourStatus(date, h, zone, numP) : "neutral";
          return (
            <button key={h} className={`hg-slot ${st} ${selectedHour===h?"sel":""}`} onClick={() => onSelect(h)}>
              <span className="hg-time">{h}</span>
              {numP > 0 && <span className={`hg-dot ${st}`} />}
            </button>
          );
        })}
      </div>
      {duration > 1 && <p style={{fontSize:'.78rem',color:'var(--tl)',fontWeight:600,marginTop:'.4rem'}}>⏱ Con {duration}h, la reserva terminaría a las {(parseInt(selectedHour||'0')+duration).toString().padStart(2,'0')}:00</p>}
      {numP > 0 && <div className="hg-legend">
        <span><span className="hg-dot free"/> Disponible</span>
        <span><span className="hg-dot combine"/> Combinable</span>
        <span><span className="hg-dot warn"/> Sin hueco</span>
        <span><span className="hg-dot full"/> Completa</span>
      </div>}
    </div>
  );
}

// ---- PReservas PAGE ----
function PReservas() {
  const [form, setForm] = useState({ name:"", email:"", phone:"", people:"", date:"", hour:"", zone:"", type:"", notes:"", duration:2 });
  const [step, setStep] = useState(1);
  const [selectedTables, setSelectedTables] = useState([]);
  const [specialMode, setSpecialMode] = useState(false);
  const FLOOR_LIVE = useApiZones(FLOOR);
  const apiOccupied = useOccupiedAPI(form.zone, form.date, form.hour, form.duration);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Max duration depends on day of week: Fri/Sat/Sun → 4h, Mon-Thu → 5h
  const maxDuration = (() => {
    if (!form.date) return 5;
    const dow = new Date(form.date + 'T12:00:00').getDay();
    return [0, 5, 6].includes(dow) ? 4 : 5;
  })();

  // End hour string for display
  const endHour = form.hour
    ? (parseInt(form.hour) + form.duration).toString().padStart(2, '0') + ':00'
    : '';

  const floor = FLOOR_LIVE[form.zone];
  const numPeople = parseInt(form.people) || 0;
  const selTables = floor ? floor.tables.filter(t => selectedTables.includes(t.id)) : [];
  const totalSeats = selTables.reduce((s, t) => s + t.seats, 0);
  const selectionOk = selectedTables.length > 0 && totalSeats >= numPeople;
  const canProceed1 = form.date && form.hour && form.zone && form.people && selectionOk;
  const canProceed2 = form.name && form.email && form.phone;

  // Check if ANY combination can fit the group in this zone/hour
  const canFitSomehow = () => {
    if (!floor || !form.hour) return true;
    const occ = getOccupied(form.date, form.hour, form.zone);
    const free = floor.tables.filter(t => !occ.includes(t.id));
    const totalFree = free.reduce((s, t) => s + t.seats, 0);
    return totalFree >= numPeople;
  };

  const showSpecialOption = form.hour && numPeople > 0 && !selectionOk && !canFitSomehow();

  // Reset tables when zone/hour/date change
  const resetTables = () => setSelectedTables([]);

  // Step 4: special request sent
  if (step === 4) return (<>
    <div className="ph"><h1>Reservar Mesa</h1><p>Solicitud especial</p></div>
    <section className="sec" style={{ textAlign:"center", maxWidth:600, margin:"0 auto", padding:"3rem 2rem" }}>
      <div style={{ background:"var(--white)", borderRadius:"var(--rl)", padding:"2.5rem", boxShadow:"var(--sh)" }}>
        {I.people(64,"#1A1A2E")}
        <h3 style={{ fontFamily:"'Lilita One',sans-serif", color:"var(--black)", fontSize:"1.5rem", margin:"1rem 0 .5rem" }}>¡Solicitud enviada!</h3>
        <p style={{ color:"var(--tm)", fontWeight:600, marginBottom:"1.5rem", lineHeight:1.6 }}>
          Hemos recibido tu solicitud para <strong>{form.people} personas</strong> en <strong>{FLOOR_LIVE[form.zone]?.name}</strong> el <strong>{form.date}</strong> a las <strong>{form.hour}</strong>.<br/><br/>
          Nuestro equipo valorará si es posible reorganizar mesas y te contactará lo antes posible.
        </p>
        <div className="av-msg av-no" style={{ textAlign:"left", maxWidth:450, margin:"0 auto 1.5rem" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#FF9800"/><path d="M12 7v6M12 16v1" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>
          <div><strong>Pendiente de confirmación</strong><span>Esto NO es una reserva confirmada. Espera nuestra respuesta.</span></div>
        </div>
        <button className="btn btn-yellow" onClick={() => { setForm({name:"",email:"",phone:"",people:"",date:"",hour:"",zone:"",type:"",notes:"",duration:2}); setStep(1); setSpecialMode(false); resetTables(); }}>Nueva reserva</button>
      </div>
    </section>
  </>);

  // Step 3: confirmed
  if (step === 3) return (<>
    <div className="ph"><h1>Reservar Mesa</h1><p>¡Tu plan perfecto!</p></div>
    <section className="sec" style={{ textAlign:"center", maxWidth:600, margin:"0 auto", padding:"3rem 2rem" }}>
      <div style={{ background:"var(--white)", borderRadius:"var(--rl)", padding:"2.5rem", boxShadow:"var(--sh)" }}>
        {I.party(72)}
        <h3 style={{ fontFamily:"'Lilita One',sans-serif", color:"var(--black)", fontSize:"1.5rem", margin:"1rem 0 .5rem" }}>¡Reserva confirmada!</h3>
        <p style={{ color:"var(--tm)", fontWeight:600, marginBottom:"1.5rem" }}>Te hemos enviado un email de confirmación</p>
        <div className="res-summary">
          <div className="res-row"><strong>Fecha</strong><span>{form.date}</span></div>
          <div className="res-row"><strong>Hora</strong><span>{form.hour} — {endHour}</span></div>
          <div className="res-row"><strong>Duración</strong><span>{form.duration} hora{form.duration !== 1 ? 's' : ''}</span></div>
          <div className="res-row"><strong>Zona</strong><span>{FLOOR_LIVE[form.zone]?.name}</span></div>
          <div className="res-row"><strong>{selectedTables.length > 1 ? "Mesas" : "Mesa"}</strong><span>{selectedTables.join(" + ")} ({totalSeats} plazas)</span></div>
          <div className="res-row"><strong>Personas</strong><span>{form.people}</span></div>
          <div className="res-row"><strong>Nombre</strong><span>{form.name}</span></div>
        </div>
        <div style={{ marginTop:"1.5rem" }}><button className="btn btn-yellow" onClick={() => { setForm({name:"",email:"",phone:"",people:"",date:"",hour:"",zone:"",type:"",notes:"",duration:2}); setStep(1); resetTables(); }}>Nueva reserva</button></div>
      </div>
    </section>
  </>);

  return (<>
    <div className="ph"><h1>Reservar Mesa</h1><p>¡Tu plan perfecto a un clic!</p></div>
    <section className="sec rbg" style={{ background:"var(--cream)" }}>
      <div className="ctn">
        {/* STEP INDICATOR */}
        <div className="res-steps">
          <div className={`res-step ${step>=1?"active":""}`}><div className="rs-num">1</div><span>Elige mesa</span></div>
          <div className="rs-line"/>
          <div className={`res-step ${step>=2?"active":""}`}><div className="rs-num">2</div><span>Tus datos</span></div>
          <div className="rs-line"/>
          <div className={`res-step ${step>=3?"active":""}`}><div className="rs-num">3</div><span>Confirmación</span></div>
        </div>

        {step === 1 && (
          <div className="res-card">
            <h2 className="res-card-title">Elige tu mesa</h2>
            <p className="res-card-sub">Selecciona fecha, zona y personas. Luego elige tu hora y haz clic en la mesa que prefieras.</p>

            <div className="res-mock-notice">
              {I.star(18,"#FF9800")}
              <span>Demo: prueba la fecha <strong>11/09/2026</strong> para ver reservas de ejemplo</span>
            </div>

            <div className="res-selectors">
              <div className="fg">
                <label>Fecha *</label>
                <input type="date" value={form.date} onChange={e => { set("date",e.target.value); set("hour",""); set("duration",2); resetTables(); }} />
              </div>
              <div className="fg">
                <label>Zona *</label>
                <select value={form.zone} onChange={e => { set("zone",e.target.value); set("hour",""); resetTables(); }}>
                  <option value="">Selecciona zona</option>
                  {Object.entries(FLOOR_LIVE).map(([k,z]) => <option key={k} value={k}>{z.name} ({z.tables.length} mesas)</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Nº de personas *</label>
                <select value={form.people} onChange={e => { set("people",e.target.value); resetTables(); }}>
                  <option value="">Selecciona</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(n => <option key={n} value={n}>{n} {n===1?"persona":"personas"}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>Duración *</label>
                <select value={form.duration} onChange={e => { set("duration", +e.target.value); resetTables(); }}>
                  {Array.from({length: maxDuration}, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{h} hora{h !== 1 ? 's' : ''}</option>
                  ))}
                </select>
                <small style={{color:'var(--tl)',fontSize:'.75rem',fontWeight:600,marginTop:'.25rem',display:'block'}}>
                  {form.date
                    ? ([0,5,6].includes(new Date(form.date+'T12:00:00').getDay()) ? '⏱ Máx. 4h (Vie/Sáb/Dom)' : '⏱ Máx. 5h (Mar–Jue)')
                    : '⏱ Máx. 4-5h según día'}
                </small>
              </div>
            </div>

            <HourGrid2 date={form.date} zone={form.zone} people={form.people} selectedHour={form.hour} duration={form.duration} onSelect={h => { set("hour",h); resetTables(); }} />

            {form.hour && form.zone && (
              <FloorPlan zone={form.zone} date={form.date} hour={form.hour} people={form.people} duration={form.duration} selected={selectedTables} onSelect={setSelectedTables} liveFloor={FLOOR_LIVE} />
            )}

            {/* Special request when no combination possible */}
            {showSpecialOption && !specialMode && (
              <div className="av-special" style={{marginTop:"1rem"}}>
                <div className="av-special-icon">{I.people(32,"#1A1A2E")}</div>
                <div className="av-special-text">
                  <strong>¿Sois un grupo grande?</strong>
                  <p>No hay plazas suficientes en esta zona/hora. Envía una solicitud y nuestro equipo valorará si puede reorganizar mesas para vosotros.</p>
                </div>
                <button className="btn btn-yellow btn-sm" onClick={() => setSpecialMode(true)}>Solicitar</button>
              </div>
            )}

            {/* Special request form */}
            {specialMode && (
              <div className="special-form">
                <div className="special-form-head">
                  <h3>Solicitud para grupo grande</h3>
                  <p>Nuestro equipo valorará si es posible reorganizar mesas para {form.people} personas en {FLOOR_LIVE[form.zone]?.name} el {form.date} a las {form.hour}.</p>
                </div>
                <div className="fgrid" style={{ maxWidth:600, margin:"0 auto" }}>
                  <div className="fg"><label>Nombre *</label><input type="text" placeholder="Tu nombre" value={form.name} onChange={e => set("name",e.target.value)} /></div>
                  <div className="fg"><label>Email *</label><input type="email" placeholder="tu@email.com" value={form.email} onChange={e => set("email",e.target.value)} /></div>
                  <div className="fg"><label>Teléfono *</label><input type="tel" placeholder="600 123 456" value={form.phone} onChange={e => set("phone",e.target.value)} /></div>
                  <div className="fg"><label>Tipo de evento</label><select value={form.type} onChange={e => set("type",e.target.value)}><option value="">Selecciona</option><option>Cumpleaños</option><option>Evento privado</option><option>Afterwork</option></select></div>
                  <div className="fg full"><label>Cuéntanos *</label><textarea placeholder="Ej: Somos 14 amigos que queremos celebrar un cumpleaños, necesitaríamos mesas juntas..." value={form.notes} onChange={e => set("notes",e.target.value)} /></div>
                </div>
                <div style={{ display:"flex", justifyContent:"center", gap:"1rem", marginTop:"1.5rem" }}>
                  <button className="btn btn-dark btn-sm" onClick={() => setSpecialMode(false)}>Cancelar</button>
                  <button className="btn btn-yellow" disabled={!(form.name&&form.email&&form.phone)} style={{opacity:form.name&&form.email&&form.phone?1:.4}} onClick={() => { setSpecialMode(false); setStep(4); }}>Enviar solicitud</button>
                </div>
              </div>
            )}

            {!specialMode && (
              <div style={{ textAlign:"center", marginTop:"2rem" }}>
                <button className="btn btn-yellow" disabled={!canProceed1} style={{ opacity:canProceed1?1:.4, cursor:canProceed1?"pointer":"not-allowed", fontSize:"1.1rem", padding:".9rem 2.5rem" }} onClick={() => canProceed1 && setStep(2)}>
                  Continuar
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="res-card">
            <h2 className="res-card-title">Paso 2: Tus datos</h2>
            <p className="res-card-sub">
              {selectedTables.length > 1 ? `Mesas ${selectedTables.join(" + ")}` : `Mesa ${selectedTables[0]}`} en {FLOOR_LIVE[form.zone]?.name} · {form.date} · {form.hour}–{endHour} ({form.duration}h) · {form.people} personas
            </p>
            <div className="fgrid" style={{ maxWidth:600, margin:"0 auto" }}>
              <div className="fg"><label>Nombre *</label><input type="text" placeholder="Tu nombre" value={form.name} onChange={e => set("name",e.target.value)} /></div>
              <div className="fg"><label>Email *</label><input type="email" placeholder="tu@email.com" value={form.email} onChange={e => set("email",e.target.value)} /></div>
              <div className="fg"><label>Teléfono *</label><input type="tel" placeholder="600 123 456" value={form.phone} onChange={e => set("phone",e.target.value)} /></div>
              <div className="fg"><label>Tipo de visita</label><select value={form.type} onChange={e => set("type",e.target.value)}><option value="">Selecciona</option><option>Visita normal</option><option>Cumpleaños</option><option>Evento privado</option><option>Afterwork</option></select></div>
              <div className="fg full"><label>Observaciones</label><textarea placeholder="¿Algo especial?" value={form.notes} onChange={e => set("notes",e.target.value)} /></div>
            </div>
            <div style={{ display:"flex", justifyContent:"center", gap:"1rem", marginTop:"2rem" }}>
              <button className="btn btn-dark" onClick={() => setStep(1)}>Volver</button>
              <button className="btn btn-yellow" disabled={!canProceed2} style={{ opacity:canProceed2?1:.4, cursor:canProceed2?"pointer":"not-allowed" }} onClick={async () => {
                if (!canProceed2) return;
                const result = await api.reservations.create({
                  date: form.date,
                  hour: form.hour,
                  duration: form.duration,
                  zoneSlug: form.zone,
                  tableCodes: selectedTables,
                  people: +form.people,
                  customerName: form.name,
                  customerEmail: form.email,
                  customerPhone: form.phone,
                  eventType: form.type || undefined,
                  notes: form.notes || undefined,
                });
                if (result) setStep(3);
                else alert('Error al crear la reserva. Puede que la mesa ya esté ocupada. Por favor, vuelve atrás y elige otra.');
              }}>Confirmar reserva</button>
            </div>
          </div>
        )}
      </div>
    </section>
  </>);
}

function PNosotros() {
  return (<>
    <div className="ph"><h1>Nosotros</h1><p>La historia detrás de El Búnker</p></div>
    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn">
        <div className="acard"><h3>¿Qué es El Búnker?</h3><p>El Búnker nació de una idea simple: crear un refugio donde cualquier persona pueda venir a pasarlo bien con juegos de mesa, buena comida y mejor compañía. No importa si eres un jugador experto o si nunca has tocado un dado. Aquí todo el mundo es bienvenido.</p></div>
        <div className="acard"><h3>Nuestra filosofía</h3><p>Creemos que los juegos de mesa son la mejor excusa para desconectar del móvil, conectar con la gente que te importa y vivir momentos que recordarás siempre. Juegos increíbles, comida con nombre propio, un equipo que te ayuda y un ambiente que te hace sentir como en casa.</p></div>
        <div className="acard"><h3>¿Por qué somos diferentes?</h3><p>No somos un bar con cuatro juegos. Somos un board game café de verdad: más de 500 juegos, carta con personalidad (Crazy Nachos, Bunker Cola, Gofres Against Humanity...), y un equipo que conoce cada juego y te recomienda el perfecto para tu grupo.</p></div>
        <div className="valgrid">
          {[{ icon: I.dice(38), t: "Diversión", d: "Lo primero siempre es pasarlo bien" }, { icon: I.people(38), t: "Para todos", d: "Familias, amigos, parejas, grupos..." }, { icon: I.heart(38), t: "Cercanía", d: "Trato personal y ambiente acogedor" }, { icon: I.star(38), t: "Calidad", d: "En juegos, comida y servicio" }].map((v, i) => <div className="valc" key={i}>{v.icon}<h4>{v.t}</h4><p>{v.d}</p></div>)}
        </div>
      </div>
    </section>
  </>);
}

function PContacto() {
  return (<>
    <div className="ph"><h1>Contacto</h1><p>¿Tienes alguna duda? ¡Escríbenos!</p></div>
    <section className="sec rbg" style={{ background: "var(--cream)" }}>
      <div className="ctn">
        <div className="cgrid">
          <div>
            <h3 style={{ fontFamily: "'Lilita One',sans-serif", color: "var(--black)", fontSize: "1.3rem", marginBottom: "1.2rem" }}>Encuéntranos</h3>
            {[{ icon: I.map(20, "#1A1A2E"), l: "Dirección", v: "Calle Ejemplo, 42 · 28001 Madrid" }, { icon: I.phone(20, "#1A1A2E"), l: "Teléfono", v: "912 345 678" }, { icon: I.mail(20), l: "Email", v: "hola@elbunker.es" }, { icon: I.gamepad(20, "#1A1A2E"), l: "Redes", v: "@elbunkermadrid" }, { icon: I.clock(20, "#1A1A2E"), l: "Horario", v: "L-J: 17-23h · V: 17-00h · S: 12-00h · D: 12-22h" }].map((c, i) => <div className="ci" key={i}><div className="cib">{c.icon}</div><div><h4>{c.l}</h4><p>{c.v}</p></div></div>)}
          </div>
          <div>
            <h3 style={{ fontFamily: "'Lilita One',sans-serif", color: "var(--black)", fontSize: "1.3rem", marginBottom: "1.2rem" }}>Escríbenos</h3>
            <div style={{ background: "var(--white)", borderRadius: "var(--rl)", padding: "1.8rem", boxShadow: "var(--sh)", borderTop: "6px solid var(--yellow)" }}>
              <div className="fgrid" style={{ gridTemplateColumns: "1fr" }}>
                <div className="fg"><label>Nombre</label><input placeholder="Tu nombre" /></div>
                <div className="fg"><label>Email</label><input type="email" placeholder="tu@email.com" /></div>
                <div className="fg"><label>Asunto</label><input placeholder="¿Sobre qué nos escribes?" /></div>
                <div className="fg"><label>Mensaje</label><textarea placeholder="Cuéntanos..." /></div>
              </div>
              <div style={{ marginTop: "1.2rem" }}><button className="btn btn-yellow" style={{ width: "100%", justifyContent: "center" }}>Enviar mensaje</button></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </>);
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("inicio");
  const [st, setSt] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const auth = useAuth();
  useEffect(() => { const h = () => setSt(window.scrollY > 400); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  useEffect(() => { if (page === "cuenta" && !auth.isLoggedIn) { setShowAuth(true); setPage("inicio"); } }, [page, auth.isLoggedIn]);
  const pages = { inicio: <PInicio setPage={setPage} />, juegos: <PJuegos />, carta: <PCarta />, preguntas: <PPreguntas setPage={setPage} />, reservas: <PReservas />, nosotros: <PNosotros />, contacto: <PContacto />, cuenta: auth.isLoggedIn ? <PMiCuenta auth={auth} setPage={setPage} /> : null };
  return (<>
    <style>{CSS}</style>
    <Nav page={page} setPage={setPage} auth={auth} onLogin={() => setShowAuth(true)} />
    <main>{pages[page] || pages.inicio}</main>
    <Foot setPage={setPage} />
    <DexterChat />
    <button className={`sctop ${st ? "vis" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑</button>
    {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={auth} />}
  </>);
}