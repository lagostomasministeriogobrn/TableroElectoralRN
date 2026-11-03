export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pregunta, datosElectorales } = req.body;

  if (!pregunta || !datosElectorales) {
    return res.status(400).json({ error: 'Faltan datos o pregunta' });
  }

  try {
    const qLower = pregunta.toLowerCase();
    
    // 1. Detección de año
    let anioConsulta = 2026;
    if (qLower.includes('2023')) anioConsulta = 2023;
    else if (qLower.includes('2025')) anioConsulta = 2025;
    else if (qLower.includes('2026')) anioConsulta = 2026;
    else if (qLower.includes('2027')) anioConsulta = 2027;

    // 2. Detección de categoría
    const mapaCategorias = {
      "gobernador": "GOB", "gobernación": "GOB", "vice": "GOB",
      "intendente": "INT", "intendencia": "INT",
      "concejal": "CON", "concejales": "CON", "concejo": "CON",
      "legislador circuital": "LEGC", "circuital": "LEGC",
      "legislador poblacional": "LEGP", "poblacional": "LEGP",
      "comision de fomento": "COF", "fomento": "COF"
    };

    let categoriaConsulta = "GOB";
    for (let [clave, codigo] of Object.entries(mapaCategorias)) {
      if (qLower.includes(clave)) {
        categoriaConsulta = codigo;
        break;
      }
    }

    // 3. Detección de localidades mencionadas (ej: Viedma, Bariloche)
    const localidadesDisponibles = [...new Set(datosElectorales.map(d => d.localidad))].filter(Boolean);
    let localidadesDetectadas = [];

    for (let loc of localidadesDisponibles) {
      let locClean = loc.toLowerCase();
      let partes = locClean.split(/[\/\-\(]/).map(p => p.trim());
      if (qLower.includes(locClean) || partes.some(p => p.length > 2 && qLower.includes(p))) {
        if (!localidadesDetectadas.includes(loc)) localidadesDetectadas.push(loc);
      }
    }

    // Si pide comparar y no detectó explícitamente dos, tomamos las principales o por defecto Viedma y Bariloche si nombra ambas
    if (localidadesDetectadas.length === 0) {
      localidadesDetectadas = ["Viedma"];
    }

    let respuestaTexto = "";

    // CASO A: Comparación cruzada de 2 o más localidades
    if (localidadesDetectadas.length >= 2 || qLower.includes('comparar') || qLower.includes(' y ')) {
      let localesAComparar = localidadesDetectadas.length >= 2 ? localidadesDetectadas.slice(-2) : ["Viedma", "San Carlos de Bariloche"];
      
      respuestaTexto = `📊 <b>Análisis Comparativo Electoral (Categoría: ${categoriaConsulta} - Año ${anioConsulta}):</b><br><br>`;

      for (let loc of localesAComparar) {
        let subDatos = datosElectorales.filter(d => 
          (d.localidad || '').toLowerCase().includes(loc.toLowerCase()) &&
          d.anio === anioConsulta &&
          d.categoria === categoriaConsulta
        );

        if (subDatos.length === 0) {
          // Búsqueda flexible sin año estricto
          subDatos = datosElectorales.filter(d => (d.localidad || '').toLowerCase().includes(loc.toLowerCase()));
        }

        if (subDatos.length === 0) {
          respuestaTexto += `📍 <b>${loc}:</b> Sin registros computados en este filtro.<br><br>`;
          continue;
        }

        let totalValidos = subDatos.reduce((acc, r) => acc + (r.votos || 0), 0);
        subDatos.sort((a, b) => b.votos - a.votos);

        let ganador = subDatos[0];
        let pctG = totalValidos > 0 ? ((ganador.votos / totalValidos) * 100).toFixed(2) : "0";
        let nombreG = ganador.nombre_lista || `Lista ${ganador.lista_id}`;

        respuestaTexto += `📍 <b>${loc}:</b><br>`;
        respuestaTexto += `• Fuerza Líder: <b>${nombreG}</b> con <b>${ganador.votos.toLocaleString()} votos</b> (${pctG}%).<br>`;

        if (subDatos.length > 1) {
          let segundo = subDatos[1];
          let pctS = totalValidos > 0 ? ((segundo.votos / totalValidos) * 100).toFixed(2) : "0";
          let nombreS = segundo.nombre_lista || `Lista ${segundo.lista_id}`;
          let diferencia = (ganador.votos - segundo.votos).toLocaleString();
          respuestaTexto += `• 2° Lugar: <b>${nombreS}</b> (${segundo.votos.toLocaleString()} votos - ${pctS}%). Margen: ${diferencia} votos.<br>`;
        }
        respuestaTexto += `<br>`;
      }

    } else {
      // CASO B: Análisis detallado de una localidad
      let localidadActiva = localidadesDetectadas[0];
      let subDatos = datosElectorales.filter(d => 
        (d.localidad || '').toLowerCase() === localidadActiva.toLowerCase() &&
        d.categoria === categoriaConsulta
      );

      let subAnio = subDatos.filter(d => d.anio === anioConsulta);
      if (subAnio.length > 0) subDatos = subAnio;

      if (subDatos.length === 0) {
        respuestaTexto = `🤖 <b>DAEBot:</b> No encontré registros cargados en Supabase para <b>${localidadActiva}</b> en la categoría seleccionada.`;
      } else {
        let totalValidos = 0;
        let totalesLista = {};

        subDatos.forEach(d => {
          let nombre = d.nombre_lista || `Lista ${d.lista_id}`;
          totalesLista[nombre] = (totalesLista[nombre] || 0) + (d.votos || 0);
          totalValidos += (d.votos || 0);
        });

        let ranking = Object.entries(totalesLista).sort((a, b) => b[1] - a[1]);
        let ganador = ranking[0];
        let pctG = totalValidos > 0 ? ((ganador[1] / totalValidos) * 100).toFixed(2) : "0";

        respuestaTexto = `📍 Cómputos para <b>${localidadActiva}</b> (Año ${anioConsulta}):<br>`;
        respuestaTexto += `• El espacio <b>${ganador[0]}</b> lidera con <b>${ganador[1].toLocaleString()} votos</b> (${pctG}% del total válido).<br>`;
        
        if (ranking.length > 1) {
          let segundo = ranking[1];
          let pctS = totalValidos > 0 ? ((segundo[1] / totalValidos) * 100).toFixed(2) : "0";
          respuestaTexto += `• En segundo lugar se ubica <b>${segundo[0]}</b> con ${segundo[1].toLocaleString()} votos (${pctS}%).`;
        }
      }
    }

    return res.status(200).json({ respuesta: respuestaTexto });

  } catch (error) {
    console.error("Error analizando datos:", error);
    return res.status(500).json({ error: 'Error interno en el servidor analítico.' });
  }
}
