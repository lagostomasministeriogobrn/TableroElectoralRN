export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pregunta, datosElectorales } = req.body;

  if (!pregunta || !datosElectorales || datosElectorales.length === 0) {
    return res.status(400).json({ error: 'Faltan datos o la base está vacía' });
  }

  try {
    const qLower = pregunta.toLowerCase();
    
    // 1. Detectar años mencionados en la pregunta o buscar el año más reciente con datos
    const aniosDisponibles = [...new Set(datosElectorales.map(d => d.anio))].filter(Boolean).sort((a,b) => b - a);
    let anioConsulta = aniosDisponibles[0] || 2026; // Toma el año con datos por defecto

    for (let anio of aniosDisponibles) {
      if (qLower.includes(anio.toString())) {
        anioConsulta = anio;
        break;
      }
    }

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

    // 3. Detección inteligente de localidades en la base
    const localidadesDisponibles = [...new Set(datosElectorales.map(d => d.localidad))].filter(Boolean);
    let localidadesDetectadas = [];

    for (let loc of localidadesDisponibles) {
      let locClean = loc.toLowerCase();
      let partes = locClean.split(/[\/\-\(]/).map(p => p.trim());
      if (qLower.includes(locClean) || partes.some(p => p.length > 2 && qLower.includes(p))) {
        if (!localidadesDetectadas.includes(loc)) localidadesDetectadas.push(loc);
      }
    }

    let respuestaTexto = "";

    // Si pide comparar o detecta varias localidades
    if (localidadesDetectadas.length >= 2 || qLower.includes('comparar') || qLower.includes(' y ')) {
      let localesAComparar = localidadesDetectadas.length >= 2 ? localidadesDetectadas : ["Viedma", "San Carlos de Bariloche"];
      
      respuestaTexto = `📊 <b>Comparativa Electoral (${categoriaConsulta} - Año ${anioConsulta}):</b><br><br>`;

      for (let loc of localesAComparar) {
        let subDatos = datosElectorales.filter(d => 
          (d.localidad || '').toLowerCase().includes(loc.toLowerCase()) &&
          d.anio === anioConsulta &&
          d.categoria === categoriaConsulta
        );

        if (subDatos.length === 0) {
          subDatos = datosElectorales.filter(d => (d.localidad || '').toLowerCase().includes(loc.toLowerCase()));
        }

        if (subDatos.length === 0) {
          respuestaTexto += `📍 <b>${loc}:</b> Sin registros cargados.<br><br>`;
          continue;
        }

        let totalValidos = subDatos.reduce((acc, r) => acc + (r.votos || 0), 0);
        subDatos.sort((a, b) => b.votos - a.votos);

        let ganador = subDatos[0];
        let pctG = totalValidos > 0 ? ((ganador.votos / totalValidos) * 100).toFixed(2) : "0";
        let nombreG = ganador.nombre_lista || `Lista ${ganador.lista_id}`;

        respuestaTexto += `📍 <b>${loc}:</b><br>`;
        respuestaTexto += `• 1° Puesto: <b>${nombreG}</b> con <b>${ganador.votos.toLocaleString()} votos</b> (${pctG}%).<br>`;

        if (subDatos.length > 1) {
          let segundo = subDatos[1];
          let pctS = totalValidos > 0 ? ((segundo.votos / totalValidos) * 100).toFixed(2) : "0";
          let nombreS = segundo.nombre_lista || `Lista ${segundo.lista_id}`;
          let diferencia = (ganador.votos - segundo.votos).toLocaleString();
          respuestaTexto += `• 2° Puesto: <b>${nombreS}</b> (${segundo.votos.toLocaleString()} votos - ${pctS}%). Margen: ${diferencia} votos.<br>`;
        }
        respuestaTexto += `<br>`;
      }

    } else {
      // Análisis de una sola localidad
      let localidadActiva = localidadesDetectadas.length > 0 ? localidadesDetectadas[0] : "Viedma";
      let subDatos = datosElectorales.filter(d => 
        (d.localidad || '').toLowerCase().includes(localidadActiva.toLowerCase()) &&
        d.categoria === categoriaConsulta
      );

      let subAnio = subDatos.filter(d => d.anio === anioConsulta);
      if (subAnio.length > 0) subDatos = subAnio;

      if (subDatos.length === 0) {
        respuestaTexto = `🤖 <b>DAEBot:</b> No encontré registros para <b>${localidadActiva}</b> en la categoría y año analizados.`;
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
        respuestaTexto += `• Lidera <b>${ganador[0]}</b> con <b>${ganador[1].toLocaleString()} votos</b> (${pctG}%).<br>`;
        
        if (ranking.length > 1) {
          let segundo = ranking[1];
          let pctS = totalValidos > 0 ? ((segundo[1] / totalValidos) * 100).toFixed(2) : "0";
          respuestaTexto += `• 2° Lugar: <b>${segundo[0]}</b> con ${segundo[1].toLocaleString()} votos (${pctS}%).`;
        }
      }
    }

    return res.status(200).json({ respuesta: respuestaTexto });

  } catch (error) {
    console.error("Error en motor analítico:", error);
    return res.status(500).json({ error: 'Error procesando la consulta en el servidor.' });
  }
}
