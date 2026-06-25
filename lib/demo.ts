import type { BesoinInput } from "./types";

// Jeu de démonstration cohérent (inspiré du data pack TDU) :
// un besoin Java/Kafka + 3 candidats de niveaux de fit volontairement
// contrastés, pour rendre le matching et le ranking parlants en live.

export const demoBesoin: BesoinInput = {
  client: "Banque de financement & d'investissement (grand compte)",
  operationnel: "Lead Tech de l'équipe Plateforme Temps Réel",
  intitule: "Développeur Senior Java / Kafka",
  fichePoste: `Au sein de l'équipe Plateforme Temps Réel (8 personnes), vous renforcez l'équipe en charge du socle de streaming de données de marché.

Missions :
- Concevoir et développer des microservices Java (Spring Boot) consommant et produisant des flux Apache Kafka à haut débit.
- Mettre en place et optimiser des pipelines Kafka Streams / Kafka Connect (exactly-once, idempotence, partitionnement).
- Garantir la résilience, l'observabilité et la performance de la plateforme (latence < 50 ms).
- Participer aux revues de code, au mentorat des profils juniors et aux choix d'architecture.

Environnement technique : Java 17/21, Spring Boot, Apache Kafka (Streams, Connect, Schema Registry), Avro, Docker, Kubernetes, CI/CD GitLab, observabilité (Prometheus / Grafana).

Profil recherché : 7+ ans d'expérience en développement back-end Java, dont une expérience significative et récente de Kafka EN PRODUCTION (pas seulement en POC). Profil hands-on, à l'aise avec le run et le debugging en environnement distribué.`,
  contexte: `Mission longue (12-18 mois) sur un programme stratégique de modernisation du socle temps réel. Le client a déjà écarté plusieurs profils jugés trop juniors sur Kafka. Process : 1 entretien tech (live coding Kafka) + 1 entretien manager. Démarrage rapide souhaité.`,
  contraintes: {
    tjm: "600 – 720 €",
    localisation: "Paris (La Défense)",
    demarrage: "ASAP — sous 3 semaines",
    teletravail: "2 jours / semaine",
  },
  historiqueOperationnel: `L'opérationnel veut du hands-on, pas de profil trop théorique ou "architecte de slides". Il challenge systématiquement les candidats sur Kafka en production (rebalancing, gestion des offsets, exactly-once) et recale ceux qui n'ont fait que du POC. Il apprécie les profils qui aiment le debugging et le run.`,
};

export interface DemoCv {
  label: string;
  text: string;
}

export const demoCvs: DemoCv[] = [
  {
    label: "Candidat A",
    text: `CANDIDAT A — Ingénieur logiciel back-end senior
Expérience : 9 ans · Disponibilité : sous 2 semaines · TJM souhaité : 680 €

COMPÉTENCES
Java 17/21, Spring Boot, Apache Kafka (Streams, Connect, Schema Registry), Avro,
microservices, Docker, Kubernetes, GitLab CI, Prometheus/Grafana, PostgreSQL.

EXPÉRIENCES
2021–2024 · Assurance (grand compte) — Tech Lead streaming
- Conception et run d'une plateforme Kafka traitant 1,2 M messages/min.
- Mise en place de l'exactly-once et de la gestion fine des offsets / rebalancing.
- Optimisation de la latence bout-en-bout de 140 ms à 40 ms.
- Mentorat de 3 développeurs, revues de code, astreintes (run en prod).

2017–2021 · Retail e-commerce — Développeur back-end Java
- Microservices Spring Boot, intégration Kafka Connect vers data lake.
- Mise en place de l'observabilité (Prometheus, alerting).

FORMATION : Master Informatique. Certifié Confluent Kafka Developer.`,
  },
  {
    label: "Candidat B",
    text: `CANDIDAT B — Développeur Java / Architecte applicatif
Expérience : 7 ans · Disponibilité : 1 mois · TJM souhaité : 640 €

COMPÉTENCES
Java 11/17, Spring Boot, REST, messaging (RabbitMQ, Kafka en POC), Docker,
conception logicielle, DDD, documentation d'architecture, PostgreSQL, MongoDB.

EXPÉRIENCES
2020–2024 · Telecom — Développeur senior / référent technique
- Développement de microservices Spring Boot, API REST à fort trafic.
- Mise en place d'un POC Kafka pour un futur socle événementiel (non passé en prod).
- Forte contribution aux dossiers d'architecture et aux choix techniques.

2017–2020 · ESN — Développeur Java
- Applications de gestion, intégration via RabbitMQ.

FORMATION : Diplôme d'ingénieur. Très à l'aise sur la conception et la documentation.`,
  },
  {
    label: "Candidat C",
    text: `CANDIDAT C — Développeur Java / Analyste
Expérience : 4 ans · Disponibilité : immédiate · TJM souhaité : 520 €

COMPÉTENCES
Java 8/11, Spring, JPA/Hibernate, SQL, rédaction de spécifications, modélisation,
analyse fonctionnelle, méthodes agiles.

EXPÉRIENCES
2022–2024 · Secteur public — Développeur Java / analyste
- Développement d'applications de gestion (Spring MVC, batchs).
- Rédaction de spécifications fonctionnelles et techniques, modélisation UML.

2020–2022 · ESN — Développeur junior
- Maintenance applicative, corrections de bugs, support.

Pas d'expérience Kafka ni de systèmes distribués temps réel.
Appétence forte pour l'analyse et la conception fonctionnelle.

FORMATION : Licence professionnelle développement.`,
  },
];
