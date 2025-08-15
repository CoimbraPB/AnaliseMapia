document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('json-upload');
    const analyzeButton = document.getElementById('analyze-button');
    const resultsContainer = document.getElementById('results');
    const loadingIndicator = document.getElementById('loading');

    analyzeButton.addEventListener('click', () => {
        if (uploadInput.files.length === 0) {
            alert('Por favor, selecione um arquivo JSON primeiro.');
            return;
        }

        const file = uploadInput.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                displayAnalysis(data);
            } catch (error) {
                alert('Erro ao processar o arquivo JSON. Verifique o formato.');
                console.error(error);
            } finally {
                loadingIndicator.classList.add('hidden');
            }
        };

        reader.onerror = () => {
            alert('Não foi possível ler o arquivo.');
            loadingIndicator.classList.add('hidden');
        };

        loadingIndicator.classList.remove('hidden');
        resultsContainer.innerHTML = ''; // Limpa resultados anteriores
        reader.readAsText(file);
    });

    function displayAnalysis(data) {
        // Garante que os dados são um array
        if (!Array.isArray(data)) {
            throw new Error("O JSON não é um array de objetos.");
        }

        // Limpa e prepara os dados
        const cleanedData = data.map(item => ({
            ...item,
            'Tempo trabalhado (min)': parseInt(item['Tempo trabalhado (min)'], 10) || 0
        }));

        // Gera e exibe cada seção de análise
        resultsContainer.innerHTML = `
            ${createSectionHTML('Análise por Caso', generateCaseAnalysis(cleanedData))}
            ${createSectionHTML('Análise por Esteira (Competência)', generateEsteiraAnalysis(cleanedData))}
            ${createSectionHTML('Produtividade por Operador', generateOperatorAnalysis(cleanedData))}
            ${createSectionHTML('Eficiência Geral e Recomendação', generateEfficiencyAnalysis(cleanedData), false)}
        `;
    }

    function createSectionHTML(title, content, isTable = true) {
        return `
            <section class="bg-white shadow-md rounded-lg p-6">
                <h3 class="text-xl font-bold mb-4 text-gray-700">${title}</h3>
                ${isTable ? `<div class="overflow-x-auto">${content}</div>` : content}
            </section>
        `;
    }

    function createTableHTML(headers, rows) {
        const headerHTML = headers.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');
        const bodyHTML = rows.map(row => `
            <tr class="bg-white hover:bg-gray-50">
                ${row.map(cell => `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${cell}</td>`).join('')}
            </tr>
        `).join('');

        return `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>${headerHTML}</tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${bodyHTML}
                </tbody>
            </table>
        `;
    }

    function generateCaseAnalysis(data) {
        const cases = {};
        data.forEach(item => {
            const caso = item.Caso;
            if (!cases[caso]) {
                cases[caso] = {
                    cliente: item.Cliente,
                    totalTime: 0,
                    entries: 0,
                    operators: new Set(),
                    anomalies: { oneMin: 0, long: 0 },
                    times: []
                };
            }
            const time = item['Tempo trabalhado (min)'];
            cases[caso].totalTime += time;
            cases[caso].entries++;
            cases[caso].operators.add(item.Operador.split(' ')[0]); // Apenas o primeiro nome
            cases[caso].times.push(time);
            if (time === 1) cases[caso].anomalies.oneMin++;
            if (time > 300) cases[caso].anomalies.long++;
        });

        const headers = ['Caso', 'Cliente', 'Tempo Total (min)', 'Nº Entradas', 'Operadores', 'Anomalias Notadas'];
        const rows = Object.entries(cases)
            .sort(([, a], [, b]) => b.totalTime - a.totalTime) // Ordena por tempo total
            .map(([caso, details]) => {
                let anomalyStr = [];
                if (details.anomalies.oneMin > 0) anomalyStr.push(`${details.anomalies.oneMin}x 1 min`);
                if (details.anomalies.long > 0) anomalyStr.push(`${details.anomalies.long}x longo (>300 min)`);

                return [
                    caso,
                    details.cliente,
                    details.totalTime,
                    details.entries,
                    Array.from(details.operators).join(', '),
                    anomalyStr.length > 0 ? anomalyStr.join('; ') : 'Nenhuma'
                ];
            });

        return createTableHTML(headers, rows);
    }

    function generateEsteiraAnalysis(data) {
        const esteiras = {};
        data.forEach(item => {
            const esteira = item.Esteira;
            if (!esteiras[esteira]) {
                esteiras[esteira] = {
                    cases: new Set(),
                    totalTime: 0,
                    entries: 0,
                    oneMinCount: 0,
                    longCount: 0
                };
            }
            const time = item['Tempo trabalhado (min)'];
            esteiras[esteira].cases.add(item.Caso);
            esteiras[esteira].totalTime += time;
            esteiras[esteira].entries++;
            if (time === 1) esteiras[esteira].oneMinCount++;
            if (time > 300) esteiras[esteira].longCount++;
        });

        const headers = ['Esteira', 'Nº Casos', 'Tempo Médio/Entrada (min)', 'Tempo Total (h)', '% de 1 min', '% Longos (>300 min)'];
        const rows = Object.entries(esteiras).map(([nome, details]) => {
            const avgTime = (details.totalTime / details.entries).toFixed(1);
            const totalHours = (details.totalTime / 60).toFixed(1);
            const oneMinPercent = ((details.oneMinCount / details.entries) * 100).toFixed(0);
            const longPercent = ((details.longCount / details.entries) * 100).toFixed(0);
            return [
                nome,
                details.cases.size,
                avgTime,
                totalHours,
                `${oneMinPercent}%`,
                `${longPercent}%`
            ];
        });

        return createTableHTML(headers, rows);
    }

    function generateOperatorAnalysis(data) {
        const operators = {};
        data.forEach(item => {
            const operator = item.Operador;
            if (!operators[operator]) {
                operators[operator] = {
                    totalTime: 0,
                    entries: 0,
                    oneMinCount: 0,
                    cases: new Set()
                };
            }
            const time = item['Tempo trabalhado (min)'];
            operators[operator].totalTime += time;
            operators[operator].entries++;
            operators[operator].cases.add(item.Caso);
            if (time === 1) operators[operator].oneMinCount++;
        });

        const headers = ['Operador', 'Tempo Total (min)', 'Nº Entradas', 'Tempo Médio/Entrada (min)', '% de 1 min', 'Casos Atendidos'];
        const rows = Object.entries(operators)
            .sort(([, a], [, b]) => b.totalTime - a.totalTime)
            .map(([nome, details]) => {
                const avgTime = (details.totalTime / details.entries).toFixed(1);
                const oneMinPercent = ((details.oneMinCount / details.entries) * 100).toFixed(0);
                return [
                    nome,
                    details.totalTime,
                    details.entries,
                    avgTime,
                    `${oneMinPercent}%`,
                    details.cases.size
                ];
            });

        return createTableHTML(headers, rows);
    }

    function generateEfficiencyAnalysis(data) {
        const totalMinutes = data.reduce((sum, item) => sum + item['Tempo trabalhado (min)'], 0);
        const totalHours = totalMinutes / 60;
        const operatorCount = new Set(data.map(item => item.Operador)).size;

        // Assumindo 20 dias úteis no mês e 8h/dia
        const hoursPerOperator = 20 * 8;
        const totalCapacityHours = operatorCount * hoursPerOperator;
        const utilization = (totalHours / totalCapacityHours) * 100;

        // Análise sem anomalias
        const filteredData = data.filter(item => item['Tempo trabalhado (min)'] > 1 && item['Tempo trabalhado (min)'] <= 300);
        const filteredMinutes = filteredData.reduce((sum, item) => sum + item['Tempo trabalhado (min)'], 0);
        const filteredHours = filteredMinutes / 60;
        const filteredUtilization = (filteredHours / totalCapacityHours) * 100;

        let recommendation = '';
        if (utilization < 40) {
            recommendation = `
                <p class="text-red-600 font-semibold">Está sobrando.</p>
                <p class="mt-2">Com uma utilização de apenas <strong>${utilization.toFixed(1)}%</strong>, a equipe está significativamente subutilizada.
                Mesmo removendo anomalias (tempos de 1 min e >300 min), a utilização fica em <strong>${filteredUtilization.toFixed(1)}%</strong>.
                Isso sugere que a capacidade atual excede a demanda.
                </p>
                <p class="mt-2"><strong>Recomendação:</strong> Avalie a possibilidade de reduzir a equipe em 1 ou 2 operadores, realocando-os para outras funções, ou aproveite a capacidade ociosa para investir em treinamento, automação de processos e melhoria contínua.</p>
            `;
        } else if (utilization > 85) {
            recommendation = `
                <p class="text-green-600 font-semibold">Pode estar faltando.</p>
                <p class="mt-2">Com uma utilização de <strong>${utilization.toFixed(1)}%</strong>, a equipe está operando perto da capacidade máxima.
                Isso pode levar a gargalos, atrasos e esgotamento dos operadores, especialmente durante picos de demanda.
                </p>
                <p class="mt-2"><strong>Recomendação:</strong> Monitore de perto os prazos e a satisfação da equipe. Considere contratar mais um operador para absorver o volume de trabalho, garantir a qualidade e manter um ambiente de trabalho sustentável.</p>
            `;
        } else {
            recommendation = `
                <p class="text-blue-600 font-semibold">Equipe parece bem dimensionada.</p>
                <p class="mt-2">A utilização de <strong>${utilization.toFixed(1)}%</strong> indica um bom equilíbrio entre a carga de trabalho e a capacidade da equipe.
                A operação parece eficiente, com margem para absorver flutuações de demanda sem sobrecarregar os operadores.
                </p>
                <p class="mt-2"><strong>Recomendação:</strong> Continue monitorando os KPIs atuais. Foque em otimizar os processos internos, como reduzir a incidência de tempos de 1 minuto (que podem indicar mau uso do sistema) e investigar os tempos excessivamente longos para identificar oportunidades de treinamento.</p>
            `;
        }

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Carga de Trabalho Total</p><p class="text-2xl font-bold">${totalHours.toFixed(1)} h</p></div>
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Nº de Operadores</p><p class="text-2xl font-bold">${operatorCount}</p></div>
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Capacidade Total Estimada</p><p class="text-2xl font-bold">${totalCapacityHours} h</p></div>
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Taxa de Utilização</p><p class="text-2xl font-bold">${utilization.toFixed(1)}%</p></div>
            </div>
            <div class="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                <h4 class="font-bold text-lg">Análise da Capacidade e Recomendação</h4>
                <div class="mt-2 text-gray-700">${recommendation}</div>
            </div>
        `;
    }
});
