/*
 * Pranav Portfolio AI Assistant
 * --------------------------------
 * GitHub Pages compatible
 *
 * Features:
 * - Loads portfolio-data.json
 * - Natural-language portfolio search
 * - Text question answering
 * - Voice input using Web Speech API
 * - Voice output using Speech Synthesis API
 * - No API key required
 *
 * Usage from script.js:
 *
 *   const answer = await PortfolioAssistant.ask("What is Pranav's experience?");
 *
 * Voice:
 *
 *   PortfolioAssistant.startListening();
 *
 * Events:
 *
 *   window.addEventListener("portfolioAI:answer", (event) => {
 *      console.log(event.detail.answer);
 *   });
 */

(() => {
  "use strict";

  const DATA_URL = "./ai/portfolio-data.json";

  let portfolioData = null;
  let dataPromise = null;
  let recognition = null;
  let isListening = false;

  /*
   * ---------------------------------------------------------
   * LOAD PORTFOLIO DATA
   * ---------------------------------------------------------
   */

  async function loadPortfolioData() {
    if (portfolioData) {
      return portfolioData;
    }

    if (dataPromise) {
      return dataPromise;
    }

    dataPromise = fetch(DATA_URL, {
      cache: "no-cache"
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load portfolio data (${response.status})`
          );
        }

        return response.json();
      })
      .then((data) => {
        portfolioData = data;
        return data;
      })
      .catch((error) => {
        console.error("Portfolio AI:", error);
        throw error;
      });

    return dataPromise;
  }

  /*
   * ---------------------------------------------------------
   * TEXT NORMALIZATION
   * ---------------------------------------------------------
   */

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s+#.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    return normalizeText(text)
      .split(" ")
      .filter((word) => word.length > 1);
  }

  function includesAny(text, words) {
    const normalized = normalizeText(text);

    return words.some((word) =>
      normalized.includes(normalizeText(word))
    );
  }

  /*
   * ---------------------------------------------------------
   * DATA EXTRACTION
   * ---------------------------------------------------------
   */

  function getAllExperience(data) {
    return Array.isArray(data.experience)
      ? data.experience
      : [];
  }

  function getAllProjects(data) {
    return Array.isArray(data.projects)
      ? data.projects
      : [];
  }

  function getAllSkills(data) {
    const skills = data.skills || {};

    return Object.entries(skills).flatMap(([category, values]) => {
      if (!Array.isArray(values)) {
        return [];
      }

      return values.map((skill) => ({
        category,
        skill
      }));
    });
  }

  /*
   * ---------------------------------------------------------
   * SEARCH ENGINE
   * ---------------------------------------------------------
   *
   * This is intentionally simple and transparent.
   * It searches your structured portfolio data instead of
   * pretending to have knowledge that isn't present.
   */

  function buildSearchDocuments(data) {
    const documents = [];

    /*
     * Profile
     */

    if (data.profile) {
      documents.push({
        type: "profile",
        title: "Profile",
        text: JSON.stringify(data.profile),
        data: data.profile
      });
    }

    /*
     * Experience
     */

    getAllExperience(data).forEach((experience) => {
      documents.push({
        type: "experience",
        title: `${experience.role || ""} at ${
          experience.company || ""
        }`,
        text: JSON.stringify(experience),
        data: experience
      });
    });

    /*
     * Current project
     */

    if (data.current_project) {
      documents.push({
        type: "current_project",
        title: `Current project - ${
          data.current_project.client || ""
        }`,
        text: JSON.stringify(data.current_project),
        data: data.current_project
      });
    }

    /*
     * Projects
     */

    getAllProjects(data).forEach((project) => {
      documents.push({
        type: "project",
        title: project.name || "Project",
        text: JSON.stringify(project),
        data: project
      });
    });

    /*
     * Skills
     */

    Object.entries(data.skills || {}).forEach(
      ([category, skills]) => {
        documents.push({
          type: "skills",
          title: category,
          text: `${category} ${
            Array.isArray(skills) ? skills.join(" ") : ""
          }`,
          data: {
            category,
            skills
          }
        });
      }
    );

    /*
     * Education
     */

    (data.education || []).forEach((education) => {
      documents.push({
        type: "education",
        title: education.degree || "Education",
        text: JSON.stringify(education),
        data: education
      });
    });

    /*
     * Certifications
     */

    (data.certifications || []).forEach((certification) => {
      documents.push({
        type: "certification",
        title: certification,
        text: certification,
        data: certification
      });
    });

    return documents;
  }

  function scoreDocument(query, document) {
    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);

    const title = normalizeText(document.title);
    const text = normalizeText(document.text);

    let score = 0;

    /*
     * Exact phrase match
     */

    if (text.includes(normalizedQuery)) {
      score += 20;
    }

    if (title.includes(normalizedQuery)) {
      score += 30;
    }

    /*
     * Individual keyword matches
     */

    queryTokens.forEach((token) => {
      if (title.includes(token)) {
        score += 8;
      }

      if (text.includes(token)) {
        score += 3;
      }
    });

    return score;
  }

  function searchPortfolio(query, data, limit = 5) {
    const documents = buildSearchDocuments(data);

    return documents
      .map((document) => ({
        ...document,
        score: scoreDocument(query, document)
      }))
      .filter((document) => document.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /*
   * ---------------------------------------------------------
   * INTENT DETECTION
   * ---------------------------------------------------------
   */

  function detectIntent(query) {
    const text = normalizeText(query);

    if (
      includesAny(text, [
        "who are you",
        "introduce yourself",
        "tell me about pranav",
        "about pranav",
        "profile",
        "who is pranav"
      ])
    ) {
      return "profile";
    }

    if (
      includesAny(text, [
        "experience",
        "worked",
        "work experience",
        "career",
        "job",
        "company",
        "companies",
        "bcg",
        "globallogic"
      ])
    ) {
      return "experience";
    }

    if (
      includesAny(text, [
        "project",
        "projects",
        "built",
        "build",
        "application",
        "app",
        "shadow analytics",
        "wisely"
      ])
    ) {
      return "projects";
    }

    if (
      includesAny(text, [
        "skill",
        "skills",
        "technology",
        "technologies",
        "tech stack",
        "tools",
        "know",
        "expertise"
      ])
    ) {
      return "skills";
    }

    if (
      includesAny(text, [
        "education",
        "degree",
        "study",
        "studied",
        "university",
        "college"
      ])
    ) {
      return "education";
    }

    if (
      includesAny(text, [
        "certification",
        "certifications",
        "certificate"
      ])
    ) {
      return "certifications";
    }

    if (
      includesAny(text, [
        "contact",
        "github",
        "website",
        "linkedin",
        "reach",
        "email"
      ])
    ) {
      return "contact";
    }

    if (
      includesAny(text, [
        "current project",
        "currently working",
        "working on now",
        "current client",
        "visa"
      ])
    ) {
      return "current_project";
    }

    if (
      includesAny(text, [
        "available",
        "availability",
        "join",
        "relocate",
        "relocation"
      ])
    ) {
      return "availability";
    }

    return "search";
  }

  /*
   * ---------------------------------------------------------
   * ANSWER GENERATION
   * ---------------------------------------------------------
   *
   * This is a deterministic answer generator.
   * Later, an LLM can replace this layer without changing
   * the voice interface or portfolio data.
   */

  function answerProfile(data) {
    const profile = data.profile || {};

    return `${profile.name || "Pranav"} is a ${
      profile.title || "data and analytics professional"
    }. ${
      profile.summary ||
      "He has experience across data, analytics, business intelligence, automation, and AI."
    }`;
  }

  function answerExperience(data, query) {
    const experience = getAllExperience(data);

    if (!experience.length) {
      return "I don't have experience information available in the portfolio data.";
    }

    const relevant = searchPortfolio(query, data, 5).filter(
      (item) => item.type === "experience"
    );

    const selected =
      relevant.length > 0
        ? relevant.map((item) => item.data)
        : experience;

    const unique = [
      ...new Map(
        selected.map((item) => [
          `${item.company}-${item.role}`,
          item
        ])
      ).values()
    ];

    return unique
      .map((item) => {
        const responsibilities = Array.isArray(
          item.responsibilities
        )
          ? item.responsibilities.slice(0, 4).join(", ")
          : "";

        const technologies = Array.isArray(item.technologies)
          ? item.technologies.join(", ")
          : "";

        let answer = `${item.role || "Role"} at ${
          item.company || "the company"
        }`;

        if (item.duration) {
          answer += ` (${item.duration})`;
        }

        if (responsibilities) {
          answer += `. Key work includes ${responsibilities}`;
        }

        if (technologies) {
          answer += `. Technologies include ${technologies}`;
        }

        return answer + ".";
      })
      .join(" ");
  }

  function answerProjects(data, query) {
    const projects = getAllProjects(data);

    if (!projects.length) {
      return "I don't have project information available.";
    }

    const relevant = searchPortfolio(query, data, 5).filter(
      (item) => item.type === "project"
    );

    const selected =
      relevant.length > 0
        ? relevant.map((item) => item.data)
        : projects;

    const unique = [
      ...new Map(
        selected.map((item) => [item.name, item])
      ).values()
    ];

    return unique
      .map((project) => {
        const technologies = Array.isArray(project.technologies)
          ? project.technologies.join(", ")
          : "";

        const features = Array.isArray(project.features)
          ? project.features.slice(0, 5).join(", ")
          : "";

        let answer = `${project.name || "This project"}`;

        if (project.type) {
          answer += ` is a ${project.type}`;
        }

        if (project.description) {
          answer += `. ${project.description}`;
        }

        if (technologies) {
          answer += ` Technologies include ${technologies}`;
        }

        if (features) {
          answer += `. Key features include ${features}`;
        }

        return answer + ".";
      })
      .join(" ");
  }

  function answerSkills(data, query) {
    const skills = data.skills || {};

    const relevantDocuments = searchPortfolio(query, data, 5)
      .filter((item) => item.type === "skills");

    if (relevantDocuments.length) {
      return relevantDocuments
        .map((item) => {
          const category = item.data.category;
          const values = item.data.skills || [];

          return `${formatCategory(category)}: ${values.join(", ")}.`;
        })
        .join(" ");
    }

    return Object.entries(skills)
      .map(([category, values]) => {
        return `${formatCategory(category)}: ${
          Array.isArray(values) ? values.join(", ") : ""
        }.`;
      })
      .join(" ");
  }

  function answerCurrentProject(data) {
    const project = data.current_project;

    if (!project) {
      return "I don't have current project information available.";
    }

    const tools = Array.isArray(project.tools)
      ? project.tools.join(", ")
      : "";

    const work = Array.isArray(project.work)
      ? project.work.slice(0, 6).join(", ")
      : "";

    let answer = `Pranav's current project is with ${
      project.client || "a client"
    }, focused on ${project.area || "data and analytics"}.`;

    if (tools) {
      answer += ` The main tools are ${tools}.`;
    }

    if (work) {
      answer += ` His work includes ${work}.`;
    }

    return answer;
  }

  function answerEducation(data) {
    const education = data.education || [];

    if (!education.length) {
      return "I don't have education information available.";
    }

    return education
      .map((item) => {
        return `${item.degree || "Degree"} from ${
          item.institution || "the institution"
        }.`;
      })
      .join(" ");
  }

  function answerCertifications(data) {
    const certifications = data.certifications || [];

    if (!certifications.length) {
      return "I don't have certification information available.";
    }

    return `Pranav's certifications include ${certifications.join(
      ", "
    )}.`;
  }

  function answerContact(data) {
    const contact = data.contact || {};

    const parts = [];

    if (contact.website) {
      parts.push(`Website: ${contact.website}`);
    }

    if (contact.github) {
      parts.push(`GitHub: ${contact.github}`);
    }

    return parts.length
      ? parts.join(". ") + "."
      : "I don't have contact links available.";
  }

  function answerAvailability(data) {
    const profile = data.profile || {};

    let answer = "";

    if (profile.availability) {
      answer += `Pranav's current availability is ${
        profile.availability
      }.`;
    }

    if (profile.relocation === true) {
      answer += " He is open to relocation.";
    } else if (profile.relocation === false) {
      answer += " He is not currently listed as open to relocation.";
    }

    return (
      answer ||
      "I don't have availability information available."
    );
  }

  function answerSearch(query, data) {
    const results = searchPortfolio(query, data, 4);

    if (!results.length) {
      return `I couldn't find anything in Pranav's portfolio that directly answers "${query}".`;
    }

    /*
     * Try to produce a useful answer based on the strongest match.
     */

    const strongest = results[0];

    if (strongest.type === "project") {
      return answerProjects(data, query);
    }

    if (strongest.type === "experience") {
      return answerExperience(data, query);
    }

    if (strongest.type === "skills") {
      return answerSkills(data, query);
    }

    if (strongest.type === "current_project") {
      return answerCurrentProject(data);
    }

    if (strongest.type === "education") {
      return answerEducation(data);
    }

    if (strongest.type === "certification") {
      return answerCertifications(data);
    }

    return answerProfile(data);
  }

  function formatCategory(category) {
    return String(category || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  /*
   * ---------------------------------------------------------
   * MAIN ASK FUNCTION
   * ---------------------------------------------------------
   */

  async function ask(question) {
    const query = String(question || "").trim();

    if (!query) {
      return "Please ask me something about Pranav.";
    }

    try {
      const data = await loadPortfolioData();

      const intent = detectIntent(query);

      let answer;

      switch (intent) {
        case "profile":
          answer = answerProfile(data);
          break;

        case "experience":
          answer = answerExperience(data, query);
          break;

        case "projects":
          answer = answerProjects(data, query);
          break;

        case "skills":
          answer = answerSkills(data, query);
          break;

        case "education":
          answer = answerEducation(data);
          break;

        case "certifications":
          answer = answerCertifications(data);
          break;

        case "contact":
          answer = answerContact(data);
          break;

        case "current_project":
          answer = answerCurrentProject(data);
          break;

        case "availability":
          answer = answerAvailability(data);
          break;

        default:
          answer = answerSearch(query, data);
      }

      dispatchEvent("answer", {
        question: query,
        answer
      });

      return answer;
    } catch (error) {
      console.error("Portfolio AI error:", error);

      const answer =
        "Sorry, I couldn't load Pranav's portfolio information right now.";

      dispatchEvent("error", {
        question: query,
        error
      });

      return answer;
    }
  }

  /*
   * ---------------------------------------------------------
   * SPEECH RECOGNITION
   * ---------------------------------------------------------
   */

  function getSpeechRecognition() {
    return (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null
    );
  }

  function startListening(options = {}) {
    const SpeechRecognitionAPI = getSpeechRecognition();

    if (!SpeechRecognitionAPI) {
      const message =
        "Voice input isn't supported in this browser. Please try Google Chrome or Microsoft Edge.";

      dispatchEvent("voiceError", {
        message
      });

      return false;
    }

    if (isListening && recognition) {
      recognition.stop();
      return true;
    }

    recognition = new SpeechRecognitionAPI();

    recognition.lang = options.lang || "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;

      dispatchEvent("listening", {
        listening: true
      });
    };

    recognition.onresult = async (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      dispatchEvent("transcript", {
        transcript:
          finalTranscript || interimTranscript,
        final: Boolean(finalTranscript)
      });

      if (finalTranscript.trim()) {
        const answer = await ask(finalTranscript.trim());

        if (options.speak !== false) {
          speak(answer, options.voiceOptions || {});
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      dispatchEvent("voiceError", {
        message: getSpeechErrorMessage(event.error),
        error: event.error
      });
    };

    recognition.onend = () => {
      isListening = false;

      dispatchEvent("listening", {
        listening: false
      });
    };

    try {
      recognition.start();
      return true;
    } catch (error) {
      console.error("Unable to start speech recognition:", error);

      isListening = false;

      dispatchEvent("voiceError", {
        message: "Unable to start the microphone.",
        error
      });

      return false;
    }
  }

  function stopListening() {
    if (recognition) {
      recognition.stop();
    }

    isListening = false;

    dispatchEvent("listening", {
      listening: false
    });
  }

  function getSpeechErrorMessage(error) {
    const messages = {
      "not-allowed":
        "Microphone permission was denied. Please allow microphone access.",
      "audio-capture":
        "No microphone was detected.",
      "no-speech":
        "I didn't hear anything. Please try again.",
      network:
        "There was a problem with speech recognition.",
      aborted:
        "Voice input was stopped."
    };

    return (
      messages[error] ||
      "Something went wrong with voice recognition."
    );
  }

  /*
   * ---------------------------------------------------------
   * TEXT TO SPEECH
   * ---------------------------------------------------------
   */

  function speak(text, options = {}) {
    if (!("speechSynthesis" in window)) {
      dispatchEvent("voiceError", {
        message:
          "Text-to-speech isn't supported in this browser."
      });

      return false;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(
      String(text || "")
    );

    utterance.lang = options.lang || "en-IN";
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;

    if (options.voice) {
      utterance.voice = options.voice;
    }

    utterance.onstart = () => {
      dispatchEvent("speaking", {
        speaking: true,
        text
      });
    };

    utterance.onend = () => {
      dispatchEvent("speaking", {
        speaking: false,
        text
      });
    };

    utterance.onerror = (event) => {
      dispatchEvent("voiceError", {
        message: "Text-to-speech failed.",
        error: event.error
      });

      dispatchEvent("speaking", {
        speaking: false,
        text
      });
    };

    window.speechSynthesis.speak(utterance);

    return true;
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      dispatchEvent("speaking", {
        speaking: false
      });
    }
  }

  function getVoices() {
    if (!("speechSynthesis" in window)) {
      return [];
    }

    return window.speechSynthesis.getVoices();
  }

  /*
   * ---------------------------------------------------------
   * EVENT SYSTEM
   * ---------------------------------------------------------
   */

  function dispatchEvent(type, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(`portfolioAI:${type}`, {
        detail
      })
    );
  }

  /*
   * ---------------------------------------------------------
   * PUBLIC API
   * ---------------------------------------------------------
   */

  window.PortfolioAssistant = {
    ask,
    loadPortfolioData,
    search: async (query, limit = 5) => {
      const data = await loadPortfolioData();
      return searchPortfolio(query, data, limit);
    },

    startListening,
    stopListening,

    speak,
    stopSpeaking,
    getVoices,

    isListening: () => isListening
  };

  /*
   * Load voices when browsers populate them asynchronously.
   */

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      dispatchEvent("voicesReady", {
        voices: getVoices()
      });
    };
  }

  console.log(
    "🤖 Portfolio Assistant loaded. Try: PortfolioAssistant.ask('Tell me about Pranav')"
  );
})();
