/**
 * Base de Conhecimento Científico Offline — Protocolo PEP
 *
 * Princípios de Governança (AGENTS.md):
 * - Local-First & Offline First: Catálogo 100% estático embutido no bundle.
 * - Não Prescrição: Dados exclusivamente educacionais e farmacocinéticos da literatura.
 *   Nunca sugere dosagens terapêuticas como recomendação médica.
 */

export const RESEARCH_DATABASE = Object.freeze([
  {
    id: "bpc-157",
    name: "BPC-157",
    fullName: "Body Protection Compound-157 (Pentadecapeptide)",
    synonyms: ["PL-10", "PL 14736", "Bepecin", "Pentadecapeptide"],
    category: "tissue-repair",
    categoryLabel: "Reparação Tecidual",
    accentColor: "var(--primary)",
    halfLifeLiterature: "Estimada em ~4 horas (plasma murino/in vitro)",
    storageGuidelines: "Frasco liofilizado a -20°C. Após reconstituição com água bacteriostática, conservar refrigerado entre 2°C e 8°C e protegido da luz.",
    suggestedSolvent: "Água Bacteriostática",
    typicalReconstitution: "2 mL para frascos de 5 mg (concentração 2500 mcg/mL)",
    literatureSummary: "Peptídeo sintético de 15 aminoácidos derivado da proteína gástrica humana de proteção corporal. Estudos pré-clínicos indicam atuação na angiogênese via via VEGF-Fak-Paxillin, reparo de tendões, ligamentos, mucosa gástrica e modulação de fatores inflamatórios.",
    mechanism: "Estimula a migração de fibroblastos, síntese de colágeno e angiogênese através da modulação da via do receptor do fator de crescimento endotelial vascular (VEGFR2). Modula a síntese de óxido nítrico endotelial (eNOS).",
    safetyNotes: "Estudos em modelos animais relatam boa tolerabilidade pré-clínica. Não é aprovado como medicamento de prescrição pela FDA ou ANVISA para uso clínico rotineiro.",
    references: [
      {
        title: "Stable gastric pentadecapeptide BPC 157 in the treatment of colitis and ischemia and reperfusion in rats",
        authors: "Sikiric P, Seiwerth S, Grabarevic Z, et al.",
        journal: "Current Pharmaceutical Design",
        year: 2011,
        pmid: "21548867",
        doi: "10.2174/138161211796117677"
      },
      {
        title: "Pentadecapeptide BPC 157 enhances the growth hormone receptor expression in tendon fibroblasts",
        authors: "Chang CH, Tsai WC, Hsu YH, Pang JH.",
        journal: "Molecules",
        year: 2014,
        pmid: "25415472",
        doi: "10.3390/molecules191119066"
      }
    ]
  },
  {
    id: "tb-500",
    name: "TB-500",
    fullName: "Thymosin Beta-4 Active Fragment (LKKTET)",
    synonyms: ["Thymosin Beta 4", "Tβ4", "LKKTET fragment", "TB500"],
    category: "tissue-repair",
    categoryLabel: "Reparação Tecidual",
    accentColor: "#38bdf8",
    halfLifeLiterature: "Estimada em ~24 a 48 horas na circulação sistêmica",
    storageGuidelines: "Conservar o pó liofilizado a 2-8°C ou -20°C. Após reconstituição, manter sob refrigeração constante (2-8°C) por até 28 dias.",
    suggestedSolvent: "Água Bacteriostática",
    typicalReconstitution: "2 mL para frascos de 5 mg ou 10 mg",
    literatureSummary: "Fragmento sintético correspondente à região ativa da Timosina Beta-4 humana, principal proteína de sequestro de actina celular. Investigada em modelos de regeneração celular, angiogênese tecidual e remodelamento de cicatrizes.",
    mechanism: "Promove a polimerização da actina celular (G-actina para F-actina), facilitando a motilidade endotelial, migração celular reparadora e redução de citocinas pró-fibróticas como TGF-beta.",
    safetyNotes: "Composto de pesquisa. Estudos clínicos fase II em reparo oftálmico e dérmico demonstraram perfil de segurança tolerável.",
    references: [
      {
        title: "Thymosin beta4: a multifunctional regenerative peptide",
        authors: "Goldstein AL, Hannappel E, Sosne G, Kleinman HK.",
        journal: "Annals of the New York Academy of Sciences",
        year: 2012,
        pmid: "22827599",
        doi: "10.1111/j.1749-6632.2012.06683.x"
      },
      {
        title: "Thymosin beta 4 accelerates wound healing",
        authors: "Philp D, Badamchian M, Scheremeta B, et al.",
        journal: "Journal of Investigative Dermatology",
        year: 2003,
        pmid: "12871383",
        doi: "10.1046/j.1523-1747.2003.12317.x"
      }
    ]
  },
  {
    id: "semaglutide",
    name: "Semaglutida",
    fullName: "Semaglutide (GLP-1 Receptor Agonist)",
    synonyms: ["GLP-1 RA", "NN9535", "Ozempic", "Wegovy", "Rybelsus"],
    category: "glp1-incretin",
    categoryLabel: "Análogos de GLP-1 & Incretinas",
    accentColor: "#10b981",
    halfLifeLiterature: "~165 a 168 horas (~7 dias) em humanos",
    storageGuidelines: "Manter sob refrigeração a 2°C–8°C. Não congelar. Proteger do calor excessivo e radiação solar direta.",
    suggestedSolvent: "Solução Salina / Diluente Original do Fabricante",
    typicalReconstitution: "Geralmente fornecido em canetas pré-reconstituídas ou 2 mL de diluente",
    literatureSummary: "Agonista seletivo do receptor do peptídeo semelhante ao glucagon-1 (GLP-1) com 94% de homologia estrutural com o GLP-1 nativo humano, modificado para ligação à albumina via cadeia de diácido graxo C18.",
    mechanism: "Aumenta a secreção de insulina dependente de glicose pelas células beta pancreáticas, suprime a secreção de glucagon, retarda o esvaziamento gástrico e atua no hipotálamo reduzindo o apetite.",
    safetyNotes: "Medicamento aprovado por agências regulatórias (FDA, EMA, ANVISA). Contraindicado em histórico pessoal ou familiar de carcinoma medular de tireoide ou síndrome NEM 2.",
    references: [
      {
        title: "Once-Weekly Semaglutide in Adults with Overweight or Obesity (STEP 1)",
        authors: "Wilding JPH, Batterham RL, Calanna S, et al.",
        journal: "New England Journal of Medicine",
        year: 2021,
        pmid: "33567185",
        doi: "10.1056/NEJMoa2032183"
      }
    ]
  },
  {
    id: "tirzepatide",
    name: "Tirzepatida",
    fullName: "Tirzepatide (Dual GIP/GLP-1 Receptor Agonist)",
    synonyms: ["Twincretin", "LY3298176", "Mounjaro", "Zepbound"],
    category: "glp1-incretin",
    categoryLabel: "Análogos de GLP-1 & Incretinas",
    accentColor: "#059669",
    halfLifeLiterature: "~116 a 120 horas (~5 dias) em humanos",
    storageGuidelines: "Armazenar refrigerado a 2°C–8°C em embalagem original opaca.",
    suggestedSolvent: "Diluente Específico do Fabricante",
    typicalReconstitution: "Geralmente administrado em dispositivo autoinjetor pré-envasado",
    literatureSummary: "Agonista duplo de receptores das incretinas GIP (polipeptídeo insulinotrópico dependente de glicose) e GLP-1. Peptídeo sintético de 39 aminoácidos com molécula de diácido graxo C20.",
    mechanism: "Estimulação sinérgica dos receptores GIP e GLP-1, aumentando a sensibilidade periférica à insulina, adipogênese saudável, saciedade central e metabolismo de lipídios.",
    safetyNotes: "Aprovado pela ANVISA, FDA e EMA para diabetes tipo 2 e controle ponderal. Requer acompanhamento médico regular.",
    references: [
      {
        title: "Tirzepatide Once Weekly for the Treatment of Obesity (SURMOUNT-1)",
        authors: "Jastreboff AM, Aronne LJ, Ahmad NN, et al.",
        journal: "New England Journal of Medicine",
        year: 2022,
        pmid: "35658024",
        doi: "10.1056/NEJMoa2206038"
      }
    ]
  },
  {
    id: "cjc-1295",
    name: "CJC-1295",
    fullName: "CJC-1295 (Mod GRF 1-29 / DAC analog)",
    synonyms: ["Modified GRF 1-29", "Mod GRF", "Tetrasubstituted GRF", "DAC:GRF"],
    category: "gh-secretagogue",
    categoryLabel: "Secretagogos de GH",
    accentColor: "#8593F7",
    halfLifeLiterature: "Mod GRF: ~30 minutos; CJC-1295 DAC: ~6 a 8 dias (conjugação com albumina)",
    storageGuidelines: "Manter liofilizado a -20°C. Após diluição com água bacteriostática, conservar a 2-8°C e ao abrigo da luz.",
    suggestedSolvent: "Água Bacteriostática",
    typicalReconstitution: "2 mL para frascos de 2 mg ou 5 mg",
    literatureSummary: "Análogo sintético do hormônio liberador do hormônio do crescimento (GHRH 1-29) com 4 substituições de aminoácidos que conferem resistência à degradação pela enzima dipeptidil peptidase-4 (DPP-4).",
    mechanism: "Liga-se aos receptores de GHRH na hipófise anterior, estimulando a síntese e a secreção pulsátil natural de GH e consequente aumento de IGF-1.",
    safetyNotes: "Substância para pesquisa. O uso de secretagogos de GH requer cautela e avaliação de eixos hormonais.",
    references: [
      {
        title: "Prolonged stimulation of growth hormone (GH) and insulin-like growth factor I secretion by CJC-1295 in healthy adults",
        authors: "Teichman SL, Neale A, Lawrence B, et al.",
        journal: "Journal of Clinical Endocrinology & Metabolism",
        year: 2006,
        pmid: "16352683",
        doi: "10.1210/jc.2005-1536"
      }
    ]
  },
  {
    id: "ipamorelin",
    name: "Ipamorelina",
    fullName: "Ipamorelin (Pentapeptide Ghrelin Receptor Agonist)",
    synonyms: ["NNC 26-0161", "Ipamoreline"],
    category: "gh-secretagogue",
    categoryLabel: "Secretagogos de GH",
    accentColor: "#6366f1",
    halfLifeLiterature: "Estimada em ~2 horas em humanos",
    storageGuidelines: "Manter frasco selado refrigerado a 2°C–8°C. Evitar agitação mecânica intensa após reconstituição.",
    suggestedSolvent: "Água Bacteriostática",
    typicalReconstitution: "2 mL para frascos de 2 mg ou 5 mg",
    literatureSummary: "Pentapeptídeo sintético seletivo agonista do receptor da grelina (GHS-R1a), reconhecido por sua alta especificidade na liberação de GH sem elevação significativa de cortisol, prolactina ou ACTH.",
    mechanism: "Ativação direta do receptor GHS-R1a nos somatotrofos hipofisários, amplificando os pulsos endógenos de liberação de GH de maneira fisiológica.",
    safetyNotes: "Molécula de pesquisa farmacológica pré-clínica e clínica inicial.",
    references: [
      {
        title: "Ipamorelin, the first selective growth hormone secretagogue",
        authors: "Raun K, Hansen BS, Johansen PB, et al.",
        journal: "European Journal of Endocrinology",
        year: 1998,
        pmid: "9849822",
        doi: "10.1530/eje.0.1390552"
      }
    ]
  },
  {
    id: "ghk-cu",
    name: "GHK-Cu",
    fullName: "Copper Tripeptide-1 (Glycyl-L-Histidyl-L-Lysine:Cu2+)",
    synonyms: ["Copper Peptide", "Tripeptide-1 Copper", "GHK Copper Complex"],
    category: "copper-peptide",
    categoryLabel: "Peptídeos de Cobre & Pele",
    accentColor: "#D89A5C",
    halfLifeLiterature: "Estimada em ~0.5 a 1 hora no plasma livre; alta avidez tecidual",
    storageGuidelines: "Proteger da luz ultravioleta. Conservar solução reconstituída entre 2°C e 8°C em frasco âmbar ou protegido.",
    suggestedSolvent: "Água Bacteriostática ou Água para Injetáveis",
    typicalReconstitution: "2 mL a 3 mL para frascos de 50 mg ou 100 mg",
    literatureSummary: "Complexo natural tripeptídico isolado no plasma humano em 1973 por Loren Pickart. Apresenta propriedades regenerativas dérmicas, modulação gênica antioxidante, aumento de colágeno, elastina e glicosaminoglicanos.",
    mechanism: "Atua como quelante e carreador biológico de cobre iônico Cu(II), regulando a expressão de mais de 4000 genes envolvidos no remodelamento de matriz extracelular, metaloproteinases e enzimas antioxidantes (SOD).",
    safetyNotes: "Amplo histórico de uso dermatológico e tópico. Aplicações parenterais exigem pureza analítica rigorosa e teste de esterilidade.",
    references: [
      {
        title: "Regenerative and Protective Actions of the GHK-Cu Peptide in the Light of the New Gene Data",
        authors: "Pickart L, Vasquez-Soltero JM, Margolina A.",
        journal: "International Journal of Molecular Sciences",
        year: 2018,
        pmid: "29986520",
        doi: "10.3390/ijms19071987"
      }
    ]
  },
  {
    id: "mots-c",
    name: "MOTS-c",
    fullName: "Mitochondrial Open Reading Frame of the 12S rRNA Type-c",
    synonyms: ["Mitochondrial Derived Peptide", "MDP MOTS-c"],
    category: "metabolic",
    categoryLabel: "Metabólico & Mitocondrial",
    accentColor: "#2FD8AC",
    halfLifeLiterature: "Curta na circulação sistêmica (~1 a 4 horas)",
    storageGuidelines: "Manter liofilizado sob congelamento (-20°C). Após reconstituição, usar água bacteriostática e manter a 2-8°C.",
    suggestedSolvent: "Água Bacteriostática",
    typicalReconstitution: "1 mL a 2 mL para frascos de 5 mg ou 10 mg",
    literatureSummary: "Peptídeo de 16 aminoácidos codificado pelo DNA mitocondrial. Funciona como sinalizador metabólico que regula a homeostase energética, a sensibilidade à insulina e a biogênese mitocondrial através da ativação da via AMPK.",
    mechanism: "Inibe a via do ciclo de folato resultando no acúmulo de AICAR e consequente fosforilação e ativação da proteína quinase ativada por AMP (AMPK), translocando GLUT4.",
    safetyNotes: "Substância de pesquisa básica em metabolismo e longevidade celular.",
    references: [
      {
        title: "The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces diet-induced obesity",
        authors: "Lee C, Zeng J, Drew BG, et al.",
        journal: "Cell Metabolism",
        year: 2015,
        pmid: "25738459",
        doi: "10.1016/j.cmet.2015.02.009"
      }
    ]
  },
  {
    id: "aod-9604",
    name: "AOD-9604",
    fullName: "Advanced Anti-Obesity Drug 9604 (C-terminal hGH fragment 177-191 with Tyr)",
    synonyms: ["hGH Fragment 177-191", "Lipolytic Fragment", "Tyr-hGH 177-191"],
    category: "metabolic",
    categoryLabel: "Metabólico & Mitocondrial",
    accentColor: "#F59158",
    halfLifeLiterature: "Estimada em ~30 a 60 minutos",
    storageGuidelines: "Manter liofilizado a -20°C. Conservar solução refrigerada (2-8°C) por até 21 dias.",
    suggestedSolvent: "Água Bacteriostática",
    typicalReconstitution: "2 mL para frascos de 5 mg",
    literatureSummary: "Fragmento sintético C-terminal do hormônio do crescimento humano (resíduos 177-191 com tirosina no N-terminal). Desenvolvido para reter as propriedades lipolíticas do hGH sem alterar a glicemia ou IGF-1.",
    mechanism: "Estimula seletivamente a lipólise em adipócitos e inibe a lipogênese via ativação de receptores beta-3 adrenérgicos sem afetar o receptor clássico de somatotropina.",
    safetyNotes: "Obteve status GRAS da FDA para certos usos orais nos EUA; aplicações injetáveis permanecem restritas a contextos de pesquisa.",
    references: [
      {
        title: "Metabolic studies for the safety and efficacy of AOD9604 in human clinical trials",
        authors: "Ng FM, Sun J, Sharma L, et al.",
        journal: "Journal of Endocrinology",
        year: 2000,
        pmid: "11018765",
        doi: "10.1677/joe.0.1670411"
      }
    ]
  },
  {
    id: "epithalon",
    name: "Epithalon",
    fullName: "Epithalon (Epithalone / Ala-Glu-Asp-Gly Tetrapeptide)",
    synonyms: ["Epitalon", "AGAG peptide", "Epithalamin synthetic fragment"],
    category: "cellular-longevity",
    categoryLabel: "Longevidade & Telômeros",
    accentColor: "#a855f7",
    halfLifeLiterature: "Estimada em ~2 horas na circulação plasmática",
    storageGuidelines: "Armazenar sob refrigeração de 2°C a 8°C. Proteger da luz solar e calor.",
    suggestedSolvent: "Água Bacteriostática ou Solução Salina 0.9%",
    typicalReconstitution: "2 mL para frascos de 10 mg ou 50 mg",
    literatureSummary: "Tetrapeptídeo sintético (L-alanil-L-glutamil-L-aspartil-glicina) baseado na epitalamina, extrato pineal estudado pelo Instituto de Biorregulação e Gerontologia de São Petersburgo pelo Prof. Vladimir Khavinson.",
    mechanism: "Estimula a atividade enzimática da telomerase em células somáticas humanas e animais, favorecendo a estabilidade cromossômica e o ciclo circadiano pineal.",
    safetyNotes: "Composto de investigação gerontológica e experimental.",
    references: [
      {
        title: "Peptide promotes overcoming of the division limit in human somatic cells",
        authors: "Khavinson VK, Bondarev IE, Butyugov AA.",
        journal: "Bulletin of Experimental Biology and Medicine",
        year: 2004,
        pmid: "15455135",
        doi: "10.1023/B:BEBM.0000035136.94042.82"
      }
    ]
  },
  {
    id: "melanotan-2",
    name: "Melanotan II",
    fullName: "Melanotan II (Cyclic Melanocortin Receptor Agonist)",
    synonyms: ["MT-2", "MT-II", "Melanotan-2"],
    category: "metabolic",
    categoryLabel: "Metabólico & Pigmentação",
    accentColor: "#eab308",
    halfLifeLiterature: "Estimada em ~1 a 2 horas no plasma",
    storageGuidelines: "Manter frasco protegido da radiação luminosa a 2-8°C após adição do diluente.",
    suggestedSolvent: "Água Bacteriostática",
    typicalReconstitution: "2 mL para frasco de 10 mg",
    literatureSummary: "Análogo sintético cíclico do hormônio estimulador de alfa-melanócitos (α-MSH). Atua nos receptores de melanocortina (MC1R, MC3R, MC4R, MC5R).",
    mechanism: "Ativação do receptor MC1R em melanócitos dérmicos induzindo melanogênese (produção de eumelanina), e ativação central de receptores MC3R/MC4R.",
    safetyNotes: "Não aprovado para uso humano recreativo. Pode provocar náuseas, hiperpigmentação de nevos e alterações hemodinâmicas transitórias.",
    references: [
      {
        title: "Melanotan II: a synthetic melanocortin analog stimulates melanogenesis in humans",
        authors: "Dorr RT, Lines R, Levine N, et al.",
        journal: "Investigational New Drugs",
        year: 1996,
        pmid: "8778435",
        doi: "10.1007/BF00180749"
      }
    ]
  },
  {
    id: "tesamorelin",
    name: "Tesamorelina",
    fullName: "Tesamorelin Acetate (GHRH Analog with trans-3-hexenoic acid)",
    synonyms: ["TH9507", "Egrifta", "Tesamorelin"],
    category: "gh-secretagogue",
    categoryLabel: "Secretagogos de GH",
    accentColor: "#818cf8",
    halfLifeLiterature: "Estimada em ~26 a 38 minutos em humanos",
    storageGuidelines: "Conservar a 2°C–8°C protegido da luz na embalagem original.",
    suggestedSolvent: "Água Estéril para Injeção / Diluente Fornecido",
    typicalReconstitution: "2 mL para frascos de 2 mg",
    literatureSummary: "Análogo sintético do fator liberador do hormônio do crescimento (GHRH 1-44) modificado por adição de um grupo ácido trans-3-hexenoico no terminal N.",
    mechanism: "Liga-se aos receptores hipofisários de GHRH, estimulando a secreção fisiológica de GH, promovendo a redução da gordura visceral profunda e melhora lipídica.",
    safetyNotes: "Medicamento aprovado pela FDA especificamente para redução do excesso de gordura visceral em lipodistrofia associada ao HIV.",
    references: [
      {
        title: "Effects of tesamorelin on visceral fat and metabolic parameters in HIV-infected patients with lipodystrophy",
        authors: "Falutz J, Allas S, Blot K, et al.",
        journal: "New England Journal of Medicine",
        year: 2007,
        pmid: "18057338",
        doi: "10.1056/NEJMoa072375"
      }
    ]
  }
]);
