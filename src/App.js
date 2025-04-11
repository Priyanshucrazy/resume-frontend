// In your package.json, add or update these dependencies:
// "react-quill": "^2.0.0",  // Use the latest version compatible with React 18
// "react-dom": "^18.2.0",   // Make sure you have the latest React DOM

// Then in your App.js file, modify the imports at the top
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Oval } from "react-loader-spinner"; 
import { jsPDF } from "jspdf"; // Import jsPDF for PDF generation
import "./App.css";

// If you're using ReactQuill, import it like this:
// import ReactQuill from 'react-quill';
// import 'react-quill/dist/quill.snow.css';

// Separate ScoreVisualizer component (unchanged)
function ScoreVisualizer({ score }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  // Convert score string like "65%" to number 65
  const numericScore = parseInt(score?.replace('%', '')) || 0;
  
  // Determine color based on score
  const getColor = (value) => {
    if (value < 50) return 'bg-red-500';
    if (value < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  // Animate the score on mount and when it changes
  useEffect(() => {
    setAnimatedScore(0);
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setAnimatedScore(prev => {
          if (prev >= numericScore) {
            clearInterval(interval);
            return numericScore;
          }
          return prev + 1;
        });
      }, 20);
      
      return () => clearInterval(interval);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [numericScore]);

  return (
    <div className="w-full max-w-md mx-auto my-6">
      <div className="mb-2 flex justify-between items-center">
        <span className="text-sm font-medium">Resume Match Score</span>
        <span className="text-lg font-bold">{animatedScore}%</span>
      </div>
      
      {/* Progress bar background */}
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        {/* Animated progress bar */}
        <div 
          className={`h-full ${getColor(animatedScore)} transition-all duration-300 ease-out`}
          style={{ width: `${animatedScore}%` }}
        />
      </div>
      
      {/* Score interpretation */}
      <div className="mt-2 text-sm">
        {numericScore < 50 && (
          <p className="text-red-500">Poor match. Consider significant resume updates.</p>
        )}
        {numericScore >= 50 && numericScore < 75 && (
          <p className="text-yellow-500">Good match. Some improvements recommended.</p>
        )}
        {numericScore >= 75 && (
          <p className="text-green-500">Excellent match! Your resume is well-aligned with this job.</p>
        )}
      </div>
    </div>
  );
}

function App() {
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("No file chosen");
  const [resumeText, setResumeText] = useState(""); // State for the extracted resume text
  const [editedResume, setEditedResume] = useState(""); // State for edited resume
  const [showEditor, setShowEditor] = useState(false); // Toggle for editor visibility
  const [extractingText, setExtractingText] = useState(false); // Loading state for text extraction
  const [parsedResult, setParsedResult] = useState(null); // Store parsed result for editor
  const [editorSections, setEditorSections] = useState({
    contact: "",
    summary: "",
    skills: "",
    experience: "",
    education: ""
  }); // Structured sections for the editor

  const handleFileChange = async (event) => {
    if (event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      
      // Extract text from the PDF when a file is selected
      if (selectedFile.type === "application/pdf") {
        setExtractingText(true);
        try {
          const formData = new FormData();
          formData.append("resume", selectedFile);
          
          // You'll need to create this endpoint in your Flask backend
          const response = await axios.post("https://resume-backend-kw58.onrender.com", formData);
          const extractedText = response.data.text;
          setResumeText(extractedText);
          setEditedResume(extractedText);
          
          // Basic attempt to split text into sections
          const sections = splitIntoSections(extractedText);
          setEditorSections(sections);
          
          setExtractingText(false);
        } catch (error) {
          console.error("Error extracting text from PDF:", error);
          setExtractingText(false);
          alert("Could not extract text from the PDF. Please try another file.");
        }
      }
    }
  };

  // Simple function to attempt to split resume text into sections
  const splitIntoSections = (text) => {
    // This is a very basic implementation - in a real app you'd want more robust parsing
    const sections = {
      contact: "",
      summary: "",
      skills: "",
      experience: "",
      education: ""
    };
    
    // Try to identify sections based on common headings
    const lines = text.split('\n');
    let currentSection = "contact"; // Default to contact for the header
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      
      if (line.includes("summary") || line.includes("objective") || line.includes("profile")) {
        currentSection = "summary";
        sections[currentSection] += lines[i] + "\n";
      } else if (line.includes("skill") || line.includes("technologies") || line.includes("competencies")) {
        currentSection = "skills";
        sections[currentSection] += lines[i] + "\n";
      } else if (line.includes("experience") || line.includes("employment") || line.includes("work history")) {
        currentSection = "experience";
        sections[currentSection] += lines[i] + "\n";
      } else if (line.includes("education") || line.includes("academic") || line.includes("degree")) {
        currentSection = "education";
        sections[currentSection] += lines[i] + "\n";
      } else {
        sections[currentSection] += lines[i] + "\n";
      }
    }
    
    return sections;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file || !jobDescription) {
      alert("Please upload a resume and enter a job description.");
      return;
    }

    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jd", jobDescription);

    try {
      const response = await axios.post("http://127.0.0.1:5000/evaluate", formData);
      setResult(response.data.evaluation);
      const parsed = parseResult(response.data.evaluation);
      setParsedResult(parsed);
    } catch (error) {
      console.error("Error:", error);
      alert("Error processing request");
    }
    setLoading(false);
  };

  const parseResult = (resultData) => {
    try {
      if (typeof resultData !== 'string') {
        return resultData;
      }
      
      let cleanData = resultData;
      if (resultData.includes('```json')) {
        cleanData = resultData.replace(/```json\n|\n```/g, '');
      }
      
      return JSON.parse(cleanData);
    } catch (e) {
      console.error("Error parsing result:", e);
      
      return {
        "raw": resultData,
        "JD Match": "N/A",
        "MissingKeywords": [],
        "Profile Summary": resultData
      };
    }
  };

  // Handle opening the editor with resume text
  const handleEditResume = () => {
    setShowEditor(true);
  };

  // Handle section update
  const handleSectionChange = (section, value) => {
    setEditorSections({
      ...editorSections,
      [section]: value
    });
  };

  // Combine all sections for the final resume text
  const combineResumeSections = () => {
    return Object.values(editorSections).join('\n\n').trim();
  };

  // Handle downloading the edited resume as PDF
  const handleDownloadResume = () => {
    const doc = new jsPDF();
    
    // Combine all sections
    const finalText = combineResumeSections();
    
    // Split text into lines and add to PDF
    const lines = doc.splitTextToSize(finalText, 180);
    doc.setFont("helvetica");
    doc.setFontSize(12);
    
    let y = 20;
    const lineHeight = 7;
    
    for (let i = 0; i < lines.length; i++) {
      // Check if we need a new page
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines[i], 15, y);
      y += lineHeight;
    }
    
    // Generate file name based on original filename or default
    const pdfName = fileName !== "No file chosen" 
      ? fileName.replace(".pdf", "-edited.pdf") 
      : "edited-resume.pdf";
    
    doc.save(pdfName);
  };

  // Display component with integrated score visualizer
  const DisplayResult = ({ resultData }) => {
    const parsedResult = parseResult(resultData);
    
    if (!parsedResult) {
      return <p>Unable to display results.</p>;
    }
    
    return (
      <div className="result-content">
        {/* Add the ScoreVisualizer here */}
        <ScoreVisualizer score={parsedResult["JD Match"] || "0%"} />
        
        <p className="match-score">
          Your resume has a match score of <strong>{parsedResult["JD Match"] || "N/A"}</strong>.
        </p>
        
        {parsedResult["MissingKeywords"] && parsedResult["MissingKeywords"].length > 0 && (
          <div className="missing-keywords">
            <p><strong>Missing Keywords:</strong></p>
            <ul>
              {parsedResult["MissingKeywords"].map((keyword, index) => (
                <li key={index}>{keyword}</li>
              ))}
            </ul>
          </div>
        )}
        
        {parsedResult["Profile Summary"] && (
          <div className="profile-summary">
            <p><strong>Profile Summary:</strong></p>
            {parsedResult["Profile Summary"].split(/\.\s+/).filter(s => s.trim()).map((sentence, index) => {
              const cleanSentence = sentence.trim();
              const formattedSentence = cleanSentence.endsWith('.') ? cleanSentence : cleanSentence + '.';
              return <p key={index}>{formattedSentence}</p>;
            })}
          </div>
        )}
        
        {resumeText && (
          <div className="edit-actions">
            <button onClick={handleEditResume} className="edit-button">
              Edit Resume
            </button>
          </div>
        )}
      </div>
    );
  };

  // A suggestion box component to show keywords to add
  const SuggestionBox = ({ missingKeywords }) => {
    if (!missingKeywords || missingKeywords.length === 0) return null;
    
    return (
      <div className="suggestion-box">
        <h4>Suggested Keywords to Add</h4>
        <div className="keyword-pills">
          {missingKeywords.map((keyword, index) => (
            <span key={index} className="keyword-pill">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <h2>🚀 Smart Resume Scanner</h2>
      <p className="bold-text">Upload your resume and get an evaluation score with tailored improvement recommendations</p>
      
      {!showEditor ? (
        <>
          <label htmlFor="job-description" className="input-label">Job Description</label>
          <textarea
            id="job-description"
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="large-textarea"
          />
          
          <div className="file-upload-container">
            <div className="file-input-wrapper">
              <label htmlFor="resume-upload" className="file-label">Upload Resume (PDF)</label>
              <input
                id="resume-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="file-input"
              />
              <p className="file-name">{fileName}</p>
              {extractingText && <p className="extracting-text">Extracting text from PDF...</p>}
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={loading || extractingText}
              className="submit-button"
            >
              {loading ? "Analyzing..." : "Analyze Resume"}
            </button>
          </div>
          
          {loading && (
            <div className="spinner">
              <Oval height={60} width={60} color="#4361ee" visible={true} />
              <p>Analyzing your resume against the job description...</p>
            </div>
          )}
          
          {result && (
            <div className="result">
              <h3>✅ Resume Analysis Results</h3>
              <DisplayResult resultData={result} />
              <details>
                <summary>View technical details</summary>
                <pre>{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
              </details>
            </div>
          )}
        </>
      ) : (
        <div className="editor-container">
          <h3>Edit Your Resume</h3>
          
          <div className="editor-header">
            <p className="editor-instructions">
              Update your resume based on the recommendations to improve your match score.
              Add the missing keywords and enhance your profile.
            </p>
            
            {parsedResult && parsedResult.MissingKeywords && (
              <SuggestionBox missingKeywords={parsedResult.MissingKeywords} />
            )}
          </div>
          
          {/* Section-based resume editor */}
          <div className="resume-sections">
            <div className="resume-section">
              <h4>Contact Information</h4>
              <textarea
                value={editorSections.contact}
                onChange={(e) => handleSectionChange('contact', e.target.value)}
                placeholder="Your name, phone, email, etc."
                className="section-textarea"
              />
            </div>
            
            <div className="resume-section">
              <h4>Professional Summary</h4>
              <textarea
                value={editorSections.summary}
                onChange={(e) => handleSectionChange('summary', e.target.value)}
                placeholder="Brief overview of your qualifications and career goals."
                className="section-textarea"
              />
            </div>
            
            <div className="resume-section">
              <h4>Skills</h4>
              <textarea
                value={editorSections.skills}
                onChange={(e) => handleSectionChange('skills', e.target.value)}
                placeholder="Technical skills, soft skills, certifications, etc."
                className="section-textarea"
              />
            </div>
            
            <div className="resume-section">
              <h4>Work Experience</h4>
              <textarea
                value={editorSections.experience}
                onChange={(e) => handleSectionChange('experience', e.target.value)}
                placeholder="Your work history, achievements, and responsibilities."
                className="section-textarea larger-textarea"
              />
            </div>
            
            <div className="resume-section">
              <h4>Education</h4>
              <textarea
                value={editorSections.education}
                onChange={(e) => handleSectionChange('education', e.target.value)}
                placeholder="Degrees, institutions, relevant coursework, etc."
                className="section-textarea"
              />
            </div>
          </div>
          
          <div className="editor-actions">
            <button onClick={() => setShowEditor(false)} className="cancel-button">
              Back to Results
            </button>
            <button onClick={handleDownloadResume} className="download-button">
              Download Resume PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;