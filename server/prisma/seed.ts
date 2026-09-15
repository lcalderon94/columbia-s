/**
 * Carga inicial de Columbia's.
 *
 * La carta está tomada de la del local de referencia que se usó como base,
 * adaptando a la marca los productos que llevaban el nombre de aquel café.
 * Los precios están en céntimos.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ALERGENOS } from '../src/types/dominio.js';

const prisma = new PrismaClient();
const hash = (t: string) => bcrypt.hashSync(t, 10);

interface ProductoSemilla {
  nombre: string;
  descripcion?: string;
  precioCent: number;
  ivaTipo?: number;
  tipo?: 'NORMAL' | 'COVER';
  vegano?: boolean;
  picante?: boolean;
  kids?: boolean;
  sinGluten?: boolean;
  alergenos?: string[];
  grupos?: string[];
  codigoRapido?: string;
}

interface CategoriaSemilla {
  nombre: string;
  destino: 'COCINA' | 'BARRA' | 'NINGUNO';
  color: string;
  productos: ProductoSemilla[];
}

const G_PUNTO = 'Punto de la carne';
const G_PAN = 'Tipo de pan';
const G_QUITAR = 'Quitar ingredientes';
const G_EXTRAS = 'Extras';
const G_LECHE = 'Tipo de leche';
const G_CAFE = 'Preparación del café';

const GRUPOS_MODIFICADOR = [
  {
    nombre: G_PUNTO,
    min: 1,
    max: 1,
    orden: 1,
    modificadores: [
      { nombre: 'Poco hecha', precioCent: 0 },
      { nombre: 'Al punto', precioCent: 0 },
      { nombre: 'Hecha', precioCent: 0 },
      { nombre: 'Muy hecha', precioCent: 0 },
    ],
  },
  {
    nombre: G_PAN,
    min: 1,
    max: 1,
    orden: 2,
    modificadores: [
      { nombre: 'Pan de la casa', precioCent: 0 },
      { nombre: 'Pan sin gluten', precioCent: 100 },
    ],
  },
  {
    nombre: G_QUITAR,
    min: 0,
    max: 8,
    orden: 3,
    modificadores: [
      { nombre: 'Sin cebolla', precioCent: 0 },
      { nombre: 'Sin tomate', precioCent: 0 },
      { nombre: 'Sin lechuga', precioCent: 0 },
      { nombre: 'Sin salsa', precioCent: 0 },
      { nombre: 'Sin bacon', precioCent: 0 },
      { nombre: 'Sin queso', precioCent: 0 },
      { nombre: 'Sin pepinillo', precioCent: 0 },
      { nombre: 'Salsa aparte', precioCent: 0 },
    ],
  },
  {
    nombre: G_EXTRAS,
    min: 0,
    max: 6,
    orden: 4,
    modificadores: [
      { nombre: 'Extra bacon', precioCent: 150 },
      { nombre: 'Extra queso', precioCent: 100 },
      { nombre: 'Extra carne', precioCent: 350 },
      { nombre: 'Huevo frito', precioCent: 100 },
      { nombre: 'Extra patatas', precioCent: 200 },
      { nombre: 'Salsa extra', precioCent: 70 },
    ],
  },
  {
    nombre: G_LECHE,
    min: 0,
    max: 1,
    orden: 5,
    modificadores: [
      { nombre: 'Leche entera', precioCent: 0 },
      { nombre: 'Leche desnatada', precioCent: 0 },
      { nombre: 'Sin lactosa', precioCent: 20 },
      { nombre: 'Bebida de avena', precioCent: 30 },
      { nombre: 'Bebida de soja', precioCent: 30 },
    ],
  },
  {
    nombre: G_CAFE,
    min: 0,
    max: 2,
    orden: 6,
    modificadores: [
      { nombre: 'Corto de café', precioCent: 0 },
      { nombre: 'Largo de café', precioCent: 0 },
      { nombre: 'Descafeinado', precioCent: 0 },
      { nombre: 'Templado', precioCent: 0 },
      { nombre: 'Para llevar', precioCent: 0 },
    ],
  },
];

const CARTA: CategoriaSemilla[] = [
  {
    nombre: 'Hamburguesas',
    destino: 'COCINA',
    color: '#ef4444',
    productos: [
      {
        nombre: "Columbia's Classic",
        descripcion:
          'Pan brioche, carne de ternera, queso cheddar, bacon ahumado, lechuga, tomate, cebolla y salsa barbacoa. Con patatas fritas.',
        precioCent: 1250,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS', 'SULFITOS', 'MOSTAZA'],
        grupos: [G_PUNTO, G_PAN, G_QUITAR, G_EXTRAS],
        sinGluten: true,
      },
      {
        nombre: 'Sweet Goat',
        descripcion:
          'Pan brioche, carne de ternera, queso de cabra, nueces garrapiñadas, cebolla caramelizada, rúcula y tomate. Con patatas fritas.',
        precioCent: 1290,
        alergenos: ['GLUTEN', 'LACTEOS', 'FRUTOS_SECOS', 'HUEVOS', 'SULFITOS'],
        grupos: [G_PUNTO, G_PAN, G_QUITAR, G_EXTRAS],
        sinGluten: true,
      },
      {
        nombre: 'Guaca & Pork',
        descripcion:
          'Pan brioche, carne de ternera, pulled pork, guacamole, bacon ahumado, cebolla caramelizada, lechuga y tomate. Con patatas fritas.',
        precioCent: 1450,
        alergenos: ['GLUTEN', 'HUEVOS', 'SULFITOS'],
        grupos: [G_PUNTO, G_PAN, G_QUITAR, G_EXTRAS],
        sinGluten: true,
      },
      {
        nombre: 'Hot',
        descripcion:
          'Pan brioche, carne de ternera, queso cheddar, bacon ahumado, lechuga, tomate, cebolla, jalapeños y mayonesa de chipotle. Con patatas fritas.',
        precioCent: 1290,
        picante: true,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS', 'SULFITOS'],
        grupos: [G_PUNTO, G_PAN, G_QUITAR, G_EXTRAS],
        sinGluten: true,
      },
      {
        nombre: 'CrunChicken',
        descripcion:
          'Pan brioche, fingers de pollo, queso cheddar, queso mozzarella, bacon ahumado, rúcula, tomate y mayonesa de albahaca. Con patatas fritas.',
        precioCent: 1290,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS', 'SULFITOS'],
        grupos: [G_PAN, G_QUITAR, G_EXTRAS],
      },
      {
        nombre: 'Kids',
        descripcion:
          'Pan brioche, carne de ternera, doble de queso cheddar, bacon ahumado y kétchup. Con patatas fritas.',
        precioCent: 990,
        kids: true,
        alergenos: ['GLUTEN', 'LACTEOS', 'SULFITOS'],
        grupos: [G_PUNTO, G_PAN, G_QUITAR],
        sinGluten: true,
      },
      {
        nombre: 'Veggie',
        descripcion:
          'Pan pretzel, carne vegetal de Heura 100% plant-based, cebolla caramelizada, lechuga, tomate, salsa chimichurri y mayonesa de albahaca. Con patatas fritas.',
        precioCent: 1320,
        vegano: true,
        alergenos: ['GLUTEN', 'SOJA'],
        grupos: [G_PAN, G_QUITAR, G_EXTRAS],
      },
    ],
  },
  {
    nombre: 'Focaccias',
    destino: 'COCINA',
    color: '#f59e0b',
    productos: [
      {
        nombre: 'Goat & Walnuts',
        descripcion:
          'Queso de cabra, nueces garrapiñadas, jamón cocido, mozzarella, tomate, rúcula y mayonesa de albahaca. Con patatas fritas.',
        precioCent: 1290,
        alergenos: ['GLUTEN', 'LACTEOS', 'FRUTOS_SECOS', 'HUEVOS'],
        grupos: [G_QUITAR, G_EXTRAS],
      },
      {
        nombre: "Columbia's Club",
        descripcion:
          'Pechuga de pollo asada desmigada, queso cheddar, bacon ahumado, jamón cocido, lechuga, tomate, cebolla y mayonesa. Con patatas fritas.',
        precioCent: 1090,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS'],
        grupos: [G_QUITAR, G_EXTRAS],
      },
      {
        nombre: 'Shepherd',
        descripcion:
          'Carne al pastor, queso cheddar, bacon ahumado, coleslaw, cebolla crunchy y salsa barbacoa. Con patatas fritas.',
        precioCent: 1230,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS', 'SULFITOS', 'MOSTAZA'],
        grupos: [G_QUITAR, G_EXTRAS],
      },
      {
        nombre: 'Italian',
        descripcion:
          'Pechuga de pollo asada desmigada, queso mozzarella, tomate, rúcula y mayonesa de albahaca. Con patatas fritas.',
        precioCent: 1150,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS'],
        grupos: [G_QUITAR, G_EXTRAS],
      },
      {
        nombre: 'Ham & Cheese',
        descripcion: 'Doble de queso cheddar y jamón cocido. Con patatas fritas.',
        precioCent: 950,
        kids: true,
        alergenos: ['GLUTEN', 'LACTEOS'],
        grupos: [G_QUITAR, G_EXTRAS],
      },
    ],
  },
  {
    nombre: 'Para compartir',
    destino: 'COCINA',
    color: '#f97316',
    productos: [
      {
        nombre: 'Croquetas Ibéricas',
        descripcion:
          'Crujientes por fuera y cremosas por dentro, elaboradas con jamón ibérico. Con mayonesa de albahaca.',
        precioCent: 890,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS'],
      },
      {
        nombre: 'Patatas 4 Salsas',
        descripcion:
          'Patatas gajo de la casa ligeramente especiadas, con mayonesa original, barbacoa, kétchup y mayonesa de chipotle.',
        precioCent: 780,
        alergenos: ['HUEVOS', 'MOSTAZA', 'SULFITOS'],
      },
      {
        nombre: 'Vegan Nuggets',
        descripcion: 'Nuggets veganos de Heura 100% plant-based. Con mayonesa de albahaca vegana.',
        precioCent: 890,
        vegano: true,
        alergenos: ['GLUTEN', 'SOJA'],
      },
      {
        nombre: 'Mozzarella Sticks',
        descripcion:
          'Palitos de queso mozzarella empanados, crujientes por fuera y fundidos por dentro. Con salsa barbacoa.',
        precioCent: 910,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS'],
      },
      {
        nombre: 'Fingers de Pollo',
        descripcion:
          'Tiras de pechuga de pollo empanadas. Con salsa barbacoa y mayonesa de chipotle.',
        precioCent: 930,
        alergenos: ['GLUTEN', 'HUEVOS', 'SULFITOS'],
      },
    ],
  },
  {
    nombre: 'Postres',
    destino: 'COCINA',
    color: '#ec4899',
    productos: [
      {
        nombre: 'Helado',
        descripcion:
          'Dos bolas de helado, sirope de caramelo o chocolate con topping de virutas de Oreo y Smarties.',
        precioCent: 550,
        kids: true,
        alergenos: ['LACTEOS', 'HUEVOS', 'GLUTEN', 'SOJA', 'FRUTOS_SECOS'],
      },
      {
        nombre: 'Coulant de chocolate',
        descripcion:
          'Bizcocho crujiente de chocolate con corazón de chocolate fundido, bola de helado y topping de virutas de Oreo y Smarties.',
        precioCent: 690,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS', 'SOJA'],
      },
      {
        nombre: "Columbia's Cookie",
        descripcion:
          'Cookie con chips de chocolate, bola de helado, sirope de caramelo o chocolate y topping de virutas de Oreo y Smarties.',
        precioCent: 620,
        kids: true,
        alergenos: ['GLUTEN', 'LACTEOS', 'HUEVOS', 'SOJA'],
      },
    ],
  },
  {
    nombre: 'Smoothies',
    destino: 'BARRA',
    color: '#84cc16',
    productos: [
      {
        nombre: 'Berries Hunter',
        descripcion: 'Zumo de manzana, fresa, granada y grosella negra.',
        precioCent: 520,
        vegano: true,
      },
      {
        nombre: 'Coconut Sunset',
        descripcion: 'Zumo de manzana, coco y piña.',
        precioCent: 520,
        vegano: true,
      },
      {
        nombre: 'Strawberry Lover',
        descripcion: 'Zumo de manzana, fresa y plátano.',
        precioCent: 520,
        vegano: true,
      },
      {
        nombre: 'Pineapple Crush',
        descripcion: 'Zumo de manzana, piña, papaya y mango.',
        precioCent: 520,
        vegano: true,
      },
    ],
  },
  {
    nombre: 'Refrescos',
    destino: 'BARRA',
    color: '#06b6d4',
    productos: [
      { nombre: 'Agua / Agua con gas', precioCent: 220, vegano: true },
      { nombre: 'Refrescos con gas', precioCent: 290, vegano: true },
      { nombre: 'Refrescos sin gas', precioCent: 310, vegano: true },
      { nombre: 'Zumos', precioCent: 270, vegano: true },
      { nombre: 'Bebidas energéticas', precioCent: 350, vegano: true },
    ],
  },
  {
    nombre: 'Cafés',
    destino: 'BARRA',
    color: '#78350f',
    productos: [
      { nombre: 'Solo / Americano', precioCent: 200, vegano: true, grupos: [G_CAFE] },
      { nombre: 'Cortado', precioCent: 210, alergenos: ['LACTEOS'], grupos: [G_LECHE, G_CAFE] },
      {
        nombre: 'Con leche / Manchado',
        precioCent: 220,
        alergenos: ['LACTEOS'],
        grupos: [G_LECHE, G_CAFE],
      },
      {
        nombre: 'Americano con leche',
        precioCent: 220,
        alergenos: ['LACTEOS'],
        grupos: [G_LECHE, G_CAFE],
      },
      { nombre: 'Capuccino', precioCent: 230, alergenos: ['LACTEOS'], grupos: [G_LECHE, G_CAFE] },
      { nombre: 'Bombón', precioCent: 250, alergenos: ['LACTEOS'], grupos: [G_CAFE] },
      { nombre: 'Bombón con leche', precioCent: 290, alergenos: ['LACTEOS'], grupos: [G_LECHE, G_CAFE] },
      {
        nombre: 'Café con Baileys',
        precioCent: 320,
        alergenos: ['LACTEOS', 'SULFITOS'],
        grupos: [G_CAFE],
      },
      { nombre: 'Latte', precioCent: 350, alergenos: ['LACTEOS'], grupos: [G_LECHE, G_CAFE] },
      { nombre: 'Café Doble', precioCent: 360, grupos: [G_LECHE, G_CAFE] },
      { nombre: 'Latte Especial', precioCent: 350, alergenos: ['LACTEOS'], grupos: [G_LECHE, G_CAFE] },
    ],
  },
  {
    nombre: 'Infusiones',
    destino: 'BARRA',
    color: '#14b8a6',
    productos: [
      { nombre: 'Infusiones', precioCent: 200, vegano: true },
      { nombre: 'Infusiones con leche', precioCent: 220, alergenos: ['LACTEOS'], grupos: [G_LECHE] },
      { nombre: 'Leche', precioCent: 150, alergenos: ['LACTEOS'], grupos: [G_LECHE] },
      { nombre: 'Leche con Cola Cao', precioCent: 220, alergenos: ['LACTEOS', 'SOJA'], grupos: [G_LECHE] },
    ],
  },
  {
    nombre: 'Cervezas',
    destino: 'BARRA',
    color: '#eab308',
    productos: [
      { nombre: 'Caña', precioCent: 230, alergenos: ['GLUTEN'] },
      { nombre: 'Tercio', precioCent: 320, alergenos: ['GLUTEN'] },
      { nombre: 'Doble', precioCent: 360, alergenos: ['GLUTEN'] },
      { nombre: 'Medio', precioCent: 420, alergenos: ['GLUTEN'] },
    ],
  },
  {
    nombre: 'Vinos',
    destino: 'BARRA',
    color: '#7f1d1d',
    productos: [
      { nombre: 'Rioja Tempranillo', precioCent: 220, alergenos: ['SULFITOS'] },
      { nombre: 'Rioja Crianza', precioCent: 310, alergenos: ['SULFITOS'] },
      { nombre: 'Rioja Reserva', precioCent: 450, alergenos: ['SULFITOS'] },
      { nombre: 'Ribera del Duero Tempranillo', precioCent: 250, alergenos: ['SULFITOS'] },
      { nombre: 'Rosado', precioCent: 220, alergenos: ['SULFITOS'] },
      { nombre: 'Blanco Verdejo Rueda', precioCent: 230, alergenos: ['SULFITOS'] },
      { nombre: 'Vermut', precioCent: 290, alergenos: ['SULFITOS'] },
      { nombre: 'Tinto de verano / Kalimotxo', precioCent: 390, alergenos: ['SULFITOS'] },
    ],
  },
  {
    nombre: 'Combinados',
    destino: 'BARRA',
    color: '#6366f1',
    productos: [
      { nombre: 'Puerto de Indias', precioCent: 950, alergenos: ['SULFITOS'] },
      { nombre: 'Tanqueray', precioCent: 950, alergenos: ['SULFITOS'] },
      { nombre: 'Bombay Sapphire', precioCent: 1000, alergenos: ['SULFITOS'] },
      { nombre: "Hendrick's", precioCent: 1050, alergenos: ['SULFITOS'] },
      { nombre: 'Johnnie Walker', precioCent: 950, alergenos: ['GLUTEN', 'SULFITOS'] },
      { nombre: "Ballantine's", precioCent: 950, alergenos: ['GLUTEN', 'SULFITOS'] },
      { nombre: 'Jack Daniels', precioCent: 1000, alergenos: ['GLUTEN', 'SULFITOS'] },
      { nombre: 'Havana Club', precioCent: 950, alergenos: ['SULFITOS'] },
      { nombre: 'Brugal Añejo', precioCent: 950, alergenos: ['SULFITOS'] },
      { nombre: 'Jose Cuervo Reposado', precioCent: 950, alergenos: ['SULFITOS'] },
      { nombre: 'Vodka Absolut', precioCent: 950, alergenos: ['GLUTEN', 'SULFITOS'] },
    ],
  },
  {
    nombre: 'Licores',
    destino: 'BARRA',
    color: '#a855f7',
    productos: [
      { nombre: 'Copa Licor de Hierbas', precioCent: 550, alergenos: ['SULFITOS'] },
      { nombre: 'Baileys', precioCent: 590, alergenos: ['LACTEOS', 'SULFITOS'] },
      { nombre: 'Chupito', precioCent: 300, alergenos: ['SULFITOS'] },
    ],
  },
  {
    nombre: 'Cover / Juegos',
    destino: 'NINGUNO',
    color: '#0f766e',
    productos: [
      {
        nombre: 'Cover consumiendo',
        descripcion: 'Acceso a la ludoteca consumiendo 4 € por persona.',
        precioCent: 400,
        tipo: 'COVER',
        codigoRapido: 'COVER_CONSUMIENDO',
      },
      {
        nombre: 'Solo jugar',
        descripcion: 'Acceso a la ludoteca sin consumición: 7 € por persona.',
        precioCent: 700,
        tipo: 'COVER',
        codigoRapido: 'COVER_SOLO_JUGAR',
      },
      {
        nombre: 'Alquiler mesa evento',
        descripcion: 'Reserva de mesa grande para torneos y eventos privados.',
        precioCent: 2500,
        tipo: 'COVER',
        codigoRapido: 'EVENTO_MESA',
      },
    ],
  },
];

const JUEGOS = [
  { nombre: 'Catan', minJugadores: 3, maxJugadores: 4, duracionMin: 75, complejidad: 2, categoria: 'ESTRATEGIA', ubicacion: 'A1' },
  { nombre: 'Carcassonne', minJugadores: 2, maxJugadores: 5, duracionMin: 45, complejidad: 2, categoria: 'FAMILIAR', ubicacion: 'A2' },
  { nombre: 'Ticket to Ride', minJugadores: 2, maxJugadores: 5, duracionMin: 60, complejidad: 2, categoria: 'FAMILIAR', ubicacion: 'A3' },
  { nombre: 'Azul', minJugadores: 2, maxJugadores: 4, duracionMin: 40, complejidad: 2, categoria: 'FAMILIAR', ubicacion: 'A4' },
  { nombre: 'Wingspan', minJugadores: 1, maxJugadores: 5, duracionMin: 70, complejidad: 3, categoria: 'ESTRATEGIA', ubicacion: 'A5' },
  { nombre: 'Terraforming Mars', minJugadores: 1, maxJugadores: 5, duracionMin: 120, complejidad: 4, categoria: 'ESTRATEGIA', ubicacion: 'B1' },
  { nombre: 'Brass: Birmingham', minJugadores: 2, maxJugadores: 4, duracionMin: 120, complejidad: 5, categoria: 'ESTRATEGIA', ubicacion: 'B2' },
  { nombre: 'Everdell', minJugadores: 1, maxJugadores: 4, duracionMin: 80, complejidad: 3, categoria: 'ESTRATEGIA', ubicacion: 'B3' },
  { nombre: 'Dixit', minJugadores: 3, maxJugadores: 6, duracionMin: 30, complejidad: 1, categoria: 'PARTY', ubicacion: 'C1' },
  { nombre: 'Codenames', minJugadores: 4, maxJugadores: 8, duracionMin: 20, complejidad: 1, categoria: 'PARTY', ubicacion: 'C2' },
  { nombre: 'Just One', minJugadores: 3, maxJugadores: 7, duracionMin: 20, complejidad: 1, categoria: 'PARTY', ubicacion: 'C3' },
  { nombre: 'The Crew', minJugadores: 2, maxJugadores: 5, duracionMin: 25, complejidad: 2, categoria: 'CARTAS', ubicacion: 'C4' },
  { nombre: 'Sushi Go!', minJugadores: 2, maxJugadores: 5, duracionMin: 20, complejidad: 1, categoria: 'CARTAS', ubicacion: 'C5' },
  { nombre: 'Virus!', minJugadores: 2, maxJugadores: 6, duracionMin: 20, complejidad: 1, categoria: 'CARTAS', ubicacion: 'C6' },
  { nombre: '7 Wonders Duel', minJugadores: 2, maxJugadores: 2, duracionMin: 30, complejidad: 3, categoria: 'ESTRATEGIA', ubicacion: 'D1' },
  { nombre: 'Patchwork', minJugadores: 2, maxJugadores: 2, duracionMin: 30, complejidad: 2, categoria: 'FAMILIAR', ubicacion: 'D2' },
  { nombre: 'Pandemic', minJugadores: 2, maxJugadores: 4, duracionMin: 45, complejidad: 3, categoria: 'FAMILIAR', ubicacion: 'D3' },
  { nombre: 'Gloomhaven: Fauces del León', minJugadores: 1, maxJugadores: 4, duracionMin: 120, complejidad: 4, categoria: 'ROL', ubicacion: 'E1' },
  { nombre: 'Aventureros al Tren: Primer Viaje', minJugadores: 2, maxJugadores: 4, duracionMin: 30, complejidad: 1, categoria: 'INFANTIL', ubicacion: 'F1' },
  { nombre: 'Dobble', minJugadores: 2, maxJugadores: 8, duracionMin: 15, complejidad: 1, categoria: 'INFANTIL', ubicacion: 'F2' },
];

const USUARIOS = [
  { nombre: 'Luis (Admin)', email: 'admin@columbias.es', pin: '1111', password: 'columbias2026', rol: 'ADMIN', color: '#1d4ed8' },
  { nombre: 'Marta (Encargada)', email: 'encargada@columbias.es', pin: '2222', password: 'encargada2026', rol: 'ENCARGADO', color: '#7c3aed' },
  { nombre: 'Javi', pin: '3333', rol: 'CAMARERO', color: '#059669' },
  { nombre: 'Lucía', pin: '3434', rol: 'CAMARERO', color: '#0891b2' },
  { nombre: 'Cocina', pin: '4444', rol: 'COCINA', color: '#dc2626' },
  { nombre: 'Barra', pin: '5555', rol: 'BARRA', color: '#ca8a04' },
];

const ZONAS = [
  {
    nombre: 'Sala',
    color: '#2563eb',
    orden: 1,
    mesas: Array.from({ length: 10 }, (_, i) => ({
      nombre: `M${i + 1}`,
      capacidad: i < 6 ? 4 : 6,
      forma: i % 2 === 0 ? 'CUADRADA' : 'REDONDA',
      posX: 60 + (i % 5) * 140,
      posY: 60 + Math.floor(i / 5) * 150,
    })),
  },
  {
    nombre: 'Zona de juego',
    color: '#7c3aed',
    orden: 2,
    mesas: Array.from({ length: 6 }, (_, i) => ({
      nombre: `J${i + 1}`,
      capacidad: i < 4 ? 6 : 8,
      forma: 'RECTANGULAR',
      ancho: 140,
      alto: 96,
      posX: 60 + (i % 3) * 190,
      posY: 60 + Math.floor(i / 3) * 150,
    })),
  },
  {
    nombre: 'Terraza',
    color: '#059669',
    orden: 3,
    mesas: Array.from({ length: 4 }, (_, i) => ({
      nombre: `T${i + 1}`,
      capacidad: 4,
      forma: 'REDONDA',
      posX: 60 + i * 140,
      posY: 60,
    })),
  },
  {
    nombre: 'Barra',
    color: '#ca8a04',
    orden: 4,
    mesas: Array.from({ length: 3 }, (_, i) => ({
      nombre: `B${i + 1}`,
      capacidad: 2,
      forma: 'BARRA',
      ancho: 80,
      alto: 60,
      posX: 60 + i * 110,
      posY: 60,
    })),
  },
];

const AJUSTES: Record<string, string> = {
  'local.nombre': "Columbia's",
  'local.razonSocial': "Columbia's Board Game Cafe S.L.",
  'local.nif': 'B00000000',
  'local.direccion': 'Calle sin definir 1',
  'local.cp': '28001',
  'local.ciudad': 'Madrid',
  'local.telefono': '600 000 000',
  'local.email': 'hola@columbias.es',
  'cover.consumiendoCent': '400',
  'cover.soloJugarCent': '700',
  'reservas.duracionPorDefectoMin': '120',
  'cocina.avisoMinutos': '15',
};

async function main() {
  console.log("Cargando datos iniciales de Columbia's...");

  // Alérgenos
  for (const a of ALERGENOS) {
    await prisma.alergeno.upsert({ where: { id: a.id }, create: a, update: { nombre: a.nombre } });
  }
  console.log(`  ${ALERGENOS.length} alérgenos`);

  // Series de facturación
  const series = [
    { id: 'S', nombre: 'Facturas simplificadas (tickets)', prefijo: 'S' },
    { id: 'F', nombre: 'Facturas completas', prefijo: 'F' },
    { id: 'R', nombre: 'Facturas rectificativas', prefijo: 'R' },
  ];
  for (const s of series) {
    await prisma.serieFactura.upsert({ where: { id: s.id }, create: s, update: { nombre: s.nombre } });
  }

  // Ajustes
  for (const [clave, valor] of Object.entries(AJUSTES)) {
    await prisma.ajuste.upsert({ where: { clave }, create: { clave, valor }, update: {} });
  }

  // Usuarios
  for (const u of USUARIOS) {
    const existe = u.email ? await prisma.usuario.findUnique({ where: { email: u.email } }) : null;
    if (existe) continue;
    const yaPorNombre = await prisma.usuario.findFirst({ where: { nombre: u.nombre } });
    if (yaPorNombre) continue;
    await prisma.usuario.create({
      data: {
        nombre: u.nombre,
        email: u.email ?? null,
        rol: u.rol,
        color: u.color,
        pinHash: hash(u.pin),
        passwordHash: u.password ? hash(u.password) : null,
      },
    });
  }
  console.log(`  ${USUARIOS.length} usuarios`);

  // Grupos de modificadores
  const grupoIds = new Map<string, string>();
  for (const g of GRUPOS_MODIFICADOR) {
    let grupo = await prisma.grupoModificador.findFirst({ where: { nombre: g.nombre } });
    if (!grupo) {
      grupo = await prisma.grupoModificador.create({
        data: {
          nombre: g.nombre,
          min: g.min,
          max: g.max,
          orden: g.orden,
          modificadores: {
            create: g.modificadores.map((m, i) => ({ ...m, orden: i })),
          },
        },
      });
    }
    grupoIds.set(g.nombre, grupo.id);
  }
  console.log(`  ${GRUPOS_MODIFICADOR.length} grupos de modificadores`);

  // Carta
  let numProductos = 0;
  for (const [i, cat] of CARTA.entries()) {
    let categoria = await prisma.categoria.findUnique({ where: { nombre: cat.nombre } });
    if (!categoria) {
      categoria = await prisma.categoria.create({
        data: { nombre: cat.nombre, orden: i, destino: cat.destino, color: cat.color },
      });
    }
    for (const [j, p] of cat.productos.entries()) {
      const existe = await prisma.producto.findFirst({
        where: { nombre: p.nombre, categoriaId: categoria.id },
      });
      if (existe) continue;
      await prisma.producto.create({
        data: {
          categoriaId: categoria.id,
          nombre: p.nombre,
          descripcion: p.descripcion ?? null,
          precioCent: p.precioCent,
          ivaTipo: p.ivaTipo ?? 10,
          tipo: p.tipo ?? 'NORMAL',
          vegano: p.vegano ?? false,
          picante: p.picante ?? false,
          kids: p.kids ?? false,
          sinGlutenDisponible: p.sinGluten ?? false,
          orden: j,
          codigoRapido: p.codigoRapido ?? null,
          alergenos: { create: (p.alergenos ?? []).map((alergenoId) => ({ alergenoId })) },
          gruposModificador: {
            create: (p.grupos ?? []).map((nombre, k) => ({
              grupoId: grupoIds.get(nombre)!,
              orden: k,
            })),
          },
        },
      });
      numProductos += 1;
    }
  }
  console.log(`  ${CARTA.length} categorías, ${numProductos} productos`);

  // Sala
  let numMesas = 0;
  for (const z of ZONAS) {
    let zona = await prisma.zona.findUnique({ where: { nombre: z.nombre } });
    if (!zona) {
      zona = await prisma.zona.create({
        data: { nombre: z.nombre, color: z.color, orden: z.orden },
      });
    }
    for (const m of z.mesas) {
      const existe = await prisma.mesa.findFirst({ where: { zonaId: zona.id, nombre: m.nombre } });
      if (existe) continue;
      await prisma.mesa.create({ data: { ...m, zonaId: zona.id } });
      numMesas += 1;
    }
  }
  console.log(`  ${ZONAS.length} zonas, ${numMesas} mesas`);

  // Ludoteca
  for (const j of JUEGOS) {
    await prisma.juego.upsert({ where: { nombre: j.nombre }, create: j, update: {} });
  }
  console.log(`  ${JUEGOS.length} juegos de mesa`);

  console.log('\nListo. Accesos de ejemplo:');
  for (const u of USUARIOS) {
    console.log(`  ${u.rol.padEnd(10)} ${u.nombre.padEnd(22)} PIN ${u.pin}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
