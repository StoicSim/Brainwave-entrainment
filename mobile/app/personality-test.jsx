import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfile } from '../context/UserProfileContext';
import { useResearchSession } from '../context/ResearchSessionContext';

const BFI2_ITEMS = [
  { id: 1, text: "Is outgoing, sociable.", domain: "Extraversion", facet: "Sociability" },
  { id: 2, text: "Is compassionate, has a soft heart.", domain: "Agreeableness", facet: "Compassion" },
  { id: 3, text: "Tends to be disorganized.", domain: "Conscientiousness", facet: "Organization", reverse: true },
  { id: 4, text: "Is relaxed, handles stress well.", domain: "Negative Emotionality", facet: "Anxiety", reverse: true },
  { id: 5, text: "Has few artistic interests.", domain: "Open-Mindedness", facet: "Aesthetic Sensitivity", reverse: true },
  { id: 6, text: "Has an assertive personality.", domain: "Extraversion", facet: "Assertiveness" },
  { id: 7, text: "Is respectful, treats others with respect.", domain: "Agreeableness", facet: "Respectfulness" },
  { id: 8, text: "Tends to be lazy.", domain: "Conscientiousness", facet: "Productiveness", reverse: true },
  { id: 9, text: "Stays optimistic after experiencing a setback.", domain: "Negative Emotionality", facet: "Depression", reverse: true },
  { id: 10, text: "Is curious about many different things.", domain: "Open-Mindedness", facet: "Intellectual Curiosity" },
  { id: 11, text: "Rarely feels excited or eager.", domain: "Extraversion", facet: "Energy Level", reverse: true },
  { id: 12, text: "Tends to find fault with others.", domain: "Agreeableness", facet: "Trust", reverse: true },
  { id: 13, text: "Is dependable, steady.", domain: "Conscientiousness", facet: "Responsibility" },
  { id: 14, text: "Is moody, has up and down mood swings.", domain: "Negative Emotionality", facet: "Emotional Volatility" },
  { id: 15, text: "Is inventive, finds clever ways to do things.", domain: "Open-Mindedness", facet: "Creative Imagination" },
  { id: 16, text: "Tends to be quiet.", domain: "Extraversion", facet: "Sociability", reverse: true },
  { id: 17, text: "Feels little sympathy for others.", domain: "Agreeableness", facet: "Compassion", reverse: true },
  { id: 18, text: "Is systematic, likes to keep things in order.", domain: "Conscientiousness", facet: "Organization" },
  { id: 19, text: "Can be tense.", domain: "Negative Emotionality", facet: "Anxiety" },
  { id: 20, text: "Is fascinated by art, music, or literature.", domain: "Open-Mindedness", facet: "Aesthetic Sensitivity" },
  { id: 21, text: "Is dominant, acts as a leader.", domain: "Extraversion", facet: "Assertiveness" },
  { id: 22, text: "Starts arguments with others.", domain: "Agreeableness", facet: "Respectfulness", reverse: true },
  { id: 23, text: "Has difficulty getting started on tasks.", domain: "Conscientiousness", facet: "Productiveness", reverse: true },
  { id: 24, text: "Feels secure, comfortable with self.", domain: "Negative Emotionality", facet: "Depression", reverse: true },
  { id: 25, text: "Avoids intellectual, philosophical discussions.", domain: "Open-Mindedness", facet: "Intellectual Curiosity", reverse: true },
  { id: 26, text: "Is less active than other people.", domain: "Extraversion", facet: "Energy Level", reverse: true },
  { id: 27, text: "Has a forgiving nature.", domain: "Agreeableness", facet: "Trust" },
  { id: 28, text: "Can be somewhat careless.", domain: "Conscientiousness", facet: "Responsibility", reverse: true },
  { id: 29, text: "Is emotionally stable, not easily upset.", domain: "Negative Emotionality", facet: "Emotional Volatility", reverse: true },
  { id: 30, text: "Has little creativity.", domain: "Open-Mindedness", facet: "Creative Imagination", reverse: true },
  { id: 31, text: "Is sometimes shy, introverted.", domain: "Extraversion", facet: "Sociability", reverse: true },
  { id: 32, text: "Is helpful and unselfish with others.", domain: "Agreeableness", facet: "Compassion" },
  { id: 33, text: "Keeps things neat and tidy.", domain: "Conscientiousness", facet: "Organization" },
  { id: 34, text: "Worries a lot.", domain: "Negative Emotionality", facet: "Anxiety" },
  { id: 35, text: "Values art and beauty.", domain: "Open-Mindedness", facet: "Aesthetic Sensitivity" },
  { id: 36, text: "Finds it hard to influence people.", domain: "Extraversion", facet: "Assertiveness", reverse: true },
  { id: 37, text: "Is sometimes rude to others.", domain: "Agreeableness", facet: "Respectfulness", reverse: true },
  { id: 38, text: "Is efficient, gets things done.", domain: "Conscientiousness", facet: "Productiveness" },
  { id: 39, text: "Often feels sad.", domain: "Negative Emotionality", facet: "Depression" },
  { id: 40, text: "Is complex, a deep thinker.", domain: "Open-Mindedness", facet: "Intellectual Curiosity" },
  { id: 41, text: "Is full of energy.", domain: "Extraversion", facet: "Energy Level" },
  { id: 42, text: "Is suspicious of others' intentions.", domain: "Agreeableness", facet: "Trust", reverse: true },
  { id: 43, text: "Is reliable, can always be counted on.", domain: "Conscientiousness", facet: "Responsibility" },
  { id: 44, text: "Keeps their emotions under control.", domain: "Negative Emotionality", facet: "Emotional Volatility", reverse: true },
  { id: 45, text: "Has difficulty imagining things.", domain: "Open-Mindedness", facet: "Creative Imagination", reverse: true },
  { id: 46, text: "Is talkative.", domain: "Extraversion", facet: "Sociability" },
  { id: 47, text: "Can be cold and uncaring.", domain: "Agreeableness", facet: "Compassion", reverse: true },
  { id: 48, text: "Leaves a mess, doesn't clean up.", domain: "Conscientiousness", facet: "Organization", reverse: true },
  { id: 49, text: "Rarely feels anxious or afraid.", domain: "Negative Emotionality", facet: "Anxiety", reverse: true },
  { id: 50, text: "Thinks poetry and plays are boring.", domain: "Open-Mindedness", facet: "Aesthetic Sensitivity", reverse: true },
  { id: 51, text: "Prefers to have others take charge.", domain: "Extraversion", facet: "Assertiveness", reverse: true },
  { id: 52, text: "Is polite, courteous to others.", domain: "Agreeableness", facet: "Respectfulness" },
  { id: 53, text: "Is persistent, works until the task is finished.", domain: "Conscientiousness", facet: "Productiveness" },
  { id: 54, text: "Tends to feel depressed, blue.", domain: "Negative Emotionality", facet: "Depression" },
  { id: 55, text: "Has little interest in abstract ideas.", domain: "Open-Mindedness", facet: "Intellectual Curiosity", reverse: true },
  { id: 56, text: "Shows a lot of enthusiasm.", domain: "Extraversion", facet: "Energy Level" },
  { id: 57, text: "Assumes the best about people.", domain: "Agreeableness", facet: "Trust" },
  { id: 58, text: "Sometimes behaves irresponsibly.", domain: "Conscientiousness", facet: "Responsibility", reverse: true },
  { id: 59, text: "Is temperamental, gets emotional easily.", domain: "Negative Emotionality", facet: "Emotional Volatility" },
  { id: 60, text: "Is original, comes up with new ideas.", domain: "Open-Mindedness", facet: "Creative Imagination" },
];

export default function PersonalityTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { updateProfile } = useUserProfile();
  const { savePersonalityTest, currentSubject } = useResearchSession();
  
  // Check if we're in research mode
  const isResearchMode = params.researchMode === 'true';
  const subjectId = params.subjectId;
  
  const [responses, setResponses] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [calculatedScores, setCalculatedScores] = useState(null);
  const scrollViewRef = React.useRef(null);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(BFI2_ITEMS.length / itemsPerPage);
  const startIdx = currentPage * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentItems = BFI2_ITEMS.slice(startIdx, endIdx);

  const handleResponse = (itemId, value) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const calculateScores = () => {
    const domainScores = {
      'Extraversion': [],
      'Agreeableness': [],
      'Conscientiousness': [],
      'Negative Emotionality': [],
      'Open-Mindedness': []
    };

    BFI2_ITEMS.forEach(item => {
      const response = responses[item.id];
      if (response) {
        const score = item.reverse ? (6 - response) : response;
        domainScores[item.domain].push(score);
      }
    });

    // Calculate mean scores and convert to 0-100 scale
    const finalScores = {};
    Object.keys(domainScores).forEach(domain => {
      const scores = domainScores[domain];
      if (scores.length > 0) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        // Convert from 1-5 scale to 0-100 scale
        const scaledScore = Math.round(((mean - 1) / 4) * 100);
        
        // Map to the correct key names
        if (domain === 'Open-Mindedness') {
          finalScores['openmindedness'] = scaledScore;
        } else if (domain === 'Negative Emotionality') {
          finalScores['negativeemotionality'] = scaledScore;
        } else {
          finalScores[domain.toLowerCase()] = scaledScore;
        }
      }
    });

    return finalScores;
  };

  const handleSubmit = () => {
    const answered = Object.keys(responses).length;
    if (answered < BFI2_ITEMS.length) {
      Alert.alert(
        'Incomplete Test',
        `You've answered ${answered} out of ${BFI2_ITEMS.length} questions. Please answer all questions.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const scores = calculateScores();
    setCalculatedScores(scores);
    setShowResults(true);
  };

  const handleSaveAndReturn = () => {
    if (isResearchMode) {
      // Save to research session
      savePersonalityTest(calculatedScores);
      
      Alert.alert(
        'Test Complete',
        `Personality test completed for Subject ${subjectId}`,
        [{ 
          text: 'OK',
          onPress: () => router.push('/research/new-subject')
        }]
      );
    } else {
      // Save to user profile (personal mode)
      updateProfile({
        personalityTest: {
          completed: true,
          timestamp: new Date().toISOString(),
          scores: calculatedScores
        }
      });
      
      setShowResults(false);
      router.push('/');
    }
  };

  const handleViewProfile = () => {
    // Only available in personal mode
    if (!isResearchMode) {
      updateProfile({
        personalityTest: {
          completed: true,
          timestamp: new Date().toISOString(),
          scores: calculatedScores
        }
      });

      setShowResults(false);
      router.push('/profile');
    }
  };

  const getDomainDescription = (domain, score) => {
    const descriptions = {
      extraversion: score > 60 ? "Outgoing and energetic" : score > 40 ? "Balanced social energy" : "Reserved and introspective",
      agreeableness: score > 60 ? "Compassionate and cooperative" : score > 40 ? "Balanced in cooperation" : "Competitive and skeptical",
      conscientiousness: score > 60 ? "Organized and disciplined" : score > 40 ? "Moderately organized" : "Flexible and spontaneous",
      negativeemotionality: score > 60 ? "Emotionally sensitive" : score > 40 ? "Emotionally balanced" : "Emotionally stable",
      openmindedness: score > 60 ? "Creative and curious" : score > 40 ? "Balanced openness" : "Practical and conventional"
    };
    return descriptions[domain] || "";
  };

  const getDomainColor = (score) => {
    if (score > 66) return '#4CAF50';
    if (score > 33) return '#FF9800';
    return '#2196F3';
  };

  const getDomainDisplayName = (domain) => {
    const names = {
      openmindedness: 'Open-Mindedness',
      conscientiousness: 'Conscientiousness',
      extraversion: 'Extraversion',
      agreeableness: 'Agreeableness',
      negativeemotionality: 'Negative Emotionality'
    };
    return names[domain] || domain;
  };

  const progress = (Object.keys(responses).length / BFI2_ITEMS.length) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Personality Test</Text>
          <Text style={styles.headerSubtitle}>
            {isResearchMode ? `Subject ${subjectId}` : 'BFI-2 Assessment'}
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Results Modal */}
      <Modal
        visible={showResults}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResults(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                <Text style={styles.modalTitle}>Test Complete!</Text>
                <Text style={styles.modalSubtitle}>
                  {isResearchMode 
                    ? `Results for Subject ${subjectId}` 
                    : 'Your Big Five Personality Profile'}
                </Text>
              </View>

              <View style={styles.resultsContainer}>
                {calculatedScores && Object.entries(calculatedScores).map(([domain, score]) => {
                  const domainName = getDomainDisplayName(domain);
                  return (
                    <View key={domain} style={styles.resultItem}>
                      <View style={styles.resultHeader}>
                        <Text style={styles.resultDomain}>{domainName}</Text>
                        <Text style={styles.resultScore}>{score}</Text>
                      </View>
                      <View style={styles.resultBarContainer}>
                        <View 
                          style={[
                            styles.resultBar, 
                            { 
                              width: `${score}%`,
                              backgroundColor: getDomainColor(score)
                            }
                          ]} 
                        />
                      </View>
                      <Text style={styles.resultDescription}>
                        {getDomainDescription(domain, score)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.modalFooter}>
                <Text style={styles.modalFooterText}>
                  Results calculated based on the Big Five personality model.
                  {isResearchMode 
                    ? ' Data saved to research session.' 
                    : ' These scores reflect your self-reported traits.'}
                </Text>
              </View>

              <View style={styles.modalButtons}>
                {!isResearchMode && (
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={handleViewProfile}
                  >
                    <Ionicons name="person" size={20} color="#2196F3" />
                    <Text style={styles.modalButtonTextSecondary}>View Profile</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={[styles.modalButton, isResearchMode && { flex: 1 }]}
                  onPress={handleSaveAndReturn}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.modalButtonText}>
                    {isResearchMode ? 'Save & Return' : 'Done'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {Object.keys(responses).length} / {BFI2_ITEMS.length} questions
        </Text>
      </View>

      <ScrollView style={styles.content} ref={scrollViewRef}>
        {currentPage === 0 && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            <Text style={styles.instructionsText}>
              Rate how much you agree with each statement about yourself.
              There are no right or wrong answers.
            </Text>
          </View>
        )}

        {currentItems.map((item) => (
          <View key={item.id} style={styles.questionCard}>
            <Text style={styles.questionNumber}>Question {item.id}</Text>
            <Text style={styles.questionText}>I am someone who {item.text}</Text>
            
            <View style={styles.scaleContainer}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.scaleButton,
                    responses[item.id] === value && styles.scaleButtonActive
                  ]}
                  onPress={() => handleResponse(item.id, value)}
                >
                  <Text style={[
                    styles.scaleButtonText,
                    responses[item.id] === value && styles.scaleButtonTextActive
                  ]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabel}>Disagree{'\n'}Strongly</Text>
              <Text style={styles.scaleLabel}>Neutral</Text>
              <Text style={styles.scaleLabel}>Agree{'\n'}Strongly</Text>
            </View>
          </View>
        ))}

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
            onPress={() => {
              setCurrentPage(prev => Math.max(0, prev - 1));
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }}
            disabled={currentPage === 0}
          >
            <Ionicons name="chevron-back" size={24} color={currentPage === 0 ? "#ccc" : "#2196F3"} />
            <Text style={[styles.navButtonText, currentPage === 0 && styles.navButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>

          <Text style={styles.pageIndicator}>
            Page {currentPage + 1} of {totalPages}
          </Text>

          {currentPage < totalPages - 1 ? (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
            >
              <Text style={styles.navButtonText}>Next</Text>
              <Ionicons name="chevron-forward" size={24} color="#2196F3" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Submit Test</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.citation}>
          <Text style={styles.citationText}>
            Based on the Big Five Inventory-2 (BFI-2)
          </Text>
          <Text style={styles.citationText}>
            Soto, C. J., & John, O. P. (2017). Journal of Personality and Social Psychology, 113, 117-143.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E3F2FD',
    marginTop: 2,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  instructions: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    margin: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  questionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  questionNumber: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    lineHeight: 22,
  },
  scaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scaleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scaleButtonActive: {
    borderColor: '#2196F3',
    backgroundColor: '#2196F3',
  },
  scaleButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  scaleButtonTextActive: {
    color: '#fff',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  scaleLabel: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    width: 70,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#ccc',
  },
  pageIndicator: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  citation: {
    padding: 20,
    marginHorizontal: 15,
    marginTop: 10,
  },
  citationText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    padding: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultItem: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultDomain: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  resultScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  resultBarContainer: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  resultBar: {
    height: '100%',
    borderRadius: 6,
  },
  resultDescription: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  modalFooter: {
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    marginBottom: 20,
  },
  modalFooterText: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
  },
  modalButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButtonTextSecondary: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '700',
  },
});