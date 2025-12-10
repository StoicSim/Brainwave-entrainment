import { UserProfileProvider } from '../context/UserProfileContext';

export default function RootLayout() {
  return (
    <UserProfileProvider>
      <BleProvider>
        <LayoutContent />
      </BleProvider>
    </UserProfileProvider>
  );
}

function LayoutContent() {
  const router = useRouter();
  const pathname = usePathname();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const { userProfile, updateProfile } = useUserProfile();
  
  // ... existing code ...
  
  return (
    <View style={styles.container}>
      <Slot />
      
      {showTabBar && (
        <Animated.View style={[styles.tabBar, { transform: [{ translateY: tabBarAnim }] }]}>
          {/* Add back button */}
          <TouchableOpacity 
            style={styles.tabButton}
            onPress={() => router.push('/')}
          >
            <Text style={styles.tabIcon}>←</Text>
            <Text style={styles.tabLabel}>Home</Text>
          </TouchableOpacity>

          {/* Existing tabs */}
          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/monitor' && styles.tabButtonActive]}
            onPress={() => router.push('/monitor')}
          >
            <Text style={styles.tabIcon}>{pathname === '/monitor' ? '📊' : '📈'}</Text>
            <Text style={[styles.tabLabel, pathname === '/monitor' && styles.tabLabelActive]}>
              Monitor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/charts' && styles.tabButtonActive]}
            onPress={() => router.push('/charts')}
          >
            <Text style={styles.tabIcon}>{pathname === '/charts' ? '📉' : '📊'}</Text>
            <Text style={[styles.tabLabel, pathname === '/charts' && styles.tabLabelActive]}>
              Charts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/analysis' && styles.tabButtonActive]}
            onPress={() => router.push('/analysis')}
          >
            <Text style={styles.tabIcon}>{pathname === '/analysis' ? '🧠' : '🔬'}</Text>
            <Text style={[styles.tabLabel, pathname === '/analysis' && styles.tabLabelActive]}>
              Analysis
            </Text>
          </TouchableOpacity>

          {/* User profile button */}
          <TouchableOpacity 
            style={styles.tabButton}
            onPress={() => setProfileModalVisible(true)}
          >
            <Text style={styles.tabIcon}>👤</Text>
            <Text style={styles.tabLabel}>Profile</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Profile Modal */}
      <UserProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        userProfile={userProfile}
        updateProfile={updateProfile}
      />
    </View>
  );
}