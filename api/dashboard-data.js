import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  try {
    const licitacionesCount = await kv.dbsize(); // Get number of keys in KV

    // Placeholder for errors, assuming no errors for now
    const errors = []; 

    response.status(200).json({
      status: "Activo",
      licitacionesAnalizadas: licitacionesCount,
      errores: errors,
      lastExecutionSummary: "Última ejecución: 26/02/2026 10:00 AM - Sin errores", // Mock data
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    response.status(500).json({
      status: "Inactivo",
      licitacionesAnalizadas: 0,
      errores: [{ message: error.message, code: error.code }],
      lastExecutionSummary: "Error al obtener datos del dashboard",
    });
  }
}
