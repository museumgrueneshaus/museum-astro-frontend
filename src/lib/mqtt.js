import mqtt from 'mqtt';

class MQTTClient {
  constructor() {
    this.client = null;
    this.config = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize(config) {
    if (!config || !config.aktiviert) {
      console.log('MQTT is disabled in configuration');
      return false;
    }

    this.config = config;
    
    try {
      const options = {
        clientId: config.client_id || `museum-kiosk-${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30 * 1000,
        keepalive: 60,
      };

      if (config.username) {
        options.username = config.username;
      }
      if (config.password) {
        options.password = config.password;
      }

      this.client = mqtt.connect(config.broker_url, options);

      this.client.on('connect', () => {
        console.log('MQTT connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.publishStatus('connected');
      });

      this.client.on('error', (error) => {
        console.error('MQTT connection error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('MQTT connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        console.log(`MQTT reconnecting... (attempt ${this.reconnectAttempts})`);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max MQTT reconnection attempts reached');
          this.client.end();
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize MQTT client:', error);
      return false;
    }
  }

  publish(topic, message, options = {}) {
    if (!this.client || !this.isConnected) {
      console.warn('MQTT client not connected, cannot publish message');
      return false;
    }

    try {
      const payload = typeof message === 'object' ? JSON.stringify(message) : message;
      this.client.publish(topic, payload, options);
      console.log(`MQTT published to ${topic}:`, payload);
      return true;
    } catch (error) {
      console.error('Failed to publish MQTT message:', error);
      return false;
    }
  }

  subscribe(topic, callback) {
    if (!this.client || !this.isConnected) {
      console.warn('MQTT client not connected, cannot subscribe');
      return false;
    }

    try {
      this.client.subscribe(topic, (error) => {
        if (error) {
          console.error(`Failed to subscribe to ${topic}:`, error);
        } else {
          console.log(`Subscribed to MQTT topic: ${topic}`);
        }
      });

      this.client.on('message', (receivedTopic, message) => {
        if (receivedTopic === topic) {
          try {
            const data = JSON.parse(message.toString());
            callback(data);
          } catch (e) {
            callback(message.toString());
          }
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to subscribe to MQTT topic:', error);
      return false;
    }
  }

  publishLightbulbEvent(exhibitData, action = 'clicked') {
    if (!this.config?.topics?.lightbulb_topic_base) {
      console.warn('Lightbulb topic base not configured');
      return false;
    }

    // Get LED segment for this exhibit
    const ledSegment = this.getExhibitLEDSegment(exhibitData);
    
    if (!ledSegment) {
      console.warn('No LED segment found for exhibit:', exhibitData.id);
      return false;
    }

    // ESP32 LED strip command format with segment addressing
    const ledCommand = {
      command: action === 'clicked' ? 'activate' : 'deactivate',
      exhibit_id: exhibitData.id,
      exhibit_title: exhibitData.title,
      exhibit_inventarnummer: exhibitData.inventarnummer,
      timestamp: new Date().toISOString(),
      // LED strip specific parameters
      led_effect: 'highlight', // or 'pulse', 'rainbow', 'solid', etc.
      led_color: this.getExhibitColor(exhibitData),
      led_brightness: 255,
      led_duration: 10000, // 10 seconds
      led_speed: 50,
      // LED segment addressing
      strip_number: ledSegment.strip_number,
      led_start: ledSegment.start,
      led_end: ledSegment.end,
      led_count: ledSegment.end - ledSegment.start + 1,
      esp32_id: ledSegment.esp32_id
    };

    // Publish to specific ESP32 topic
    const topic = `${this.config.topics.lightbulb_topic_base}/strip${ledSegment.strip_number}`;
    return this.publish(topic, ledCommand);
  }

  getExhibitColor(exhibitData) {
    // Map exhibit categories or other data to LED colors
    const colorMap = {
      'kunst': { r: 255, g: 0, b: 255 },     // Magenta for art
      'geschichte': { r: 255, g: 165, b: 0 }, // Orange for history
      'natur': { r: 0, g: 255, b: 0 },       // Green for nature
      'technik': { r: 0, g: 0, b: 255 },     // Blue for technology
      'default': { r: 255, g: 255, b: 255 }  // White as default
    };

    // Try to get color from exhibit category or use default
    const category = exhibitData.categoryId || exhibitData.kategorie?.slug || 'default';
    return colorMap[category] || colorMap['default'];
  }

  getExhibitLEDSegment(exhibitData) {
    // Get LED segment from exhibit data (configured in Sanity)
    if (exhibitData.led_position) {
      const ledPos = exhibitData.led_position;
      
      // Find the corresponding ESP32 configuration
      const stripConfig = this.config?.led_strips?.find(
        strip => strip.strip_number === ledPos.strip_number
      );
      
      if (!stripConfig) {
        console.warn(`No strip configuration found for strip ${ledPos.strip_number}`);
        return null;
      }
      
      return {
        strip_number: ledPos.strip_number,
        start: ledPos.led_start,
        end: ledPos.led_end,
        count: ledPos.led_end - ledPos.led_start + 1,
        esp32_id: stripConfig.esp32_id,
        raum_position: ledPos.raum_position
      };
    }
    
    // Fallback: if no LED position is configured, return null
    console.warn('No LED position configured for exhibit:', exhibitData.id);
    return null;
  }

  hashString(str) {
    // Simple hash function to convert string to number
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Additional LED strip control methods
  publishLEDCommand(command, params = {}) {
    if (!this.config?.topics?.lightbulb_topic) {
      console.warn('LED topic not configured');
      return false;
    }

    const ledCommand = {
      command: command,
      timestamp: new Date().toISOString(),
      ...params
    };

    return this.publish(this.config.topics.lightbulb_topic, ledCommand);
  }

  // Predefined LED effects for different scenarios
  publishLEDEffect(effect, color = { r: 255, g: 255, b: 255 }, duration = 5000) {
    return this.publishLEDCommand('effect', {
      effect: effect,
      color: color,
      duration: duration,
      brightness: 255,
      speed: 50
    });
  }

  // Turn off LED strip
  publishLEDOff() {
    return this.publishLEDCommand('off');
  }

  // Set solid color
  publishLEDColor(color, brightness = 255) {
    return this.publishLEDCommand('solid', {
      color: color,
      brightness: brightness
    });
  }

  publishInteraction(type, data = {}) {
    if (!this.config?.topics?.interaction_topic) {
      console.warn('Interaction topic not configured');
      return false;
    }

    const message = {
      timestamp: new Date().toISOString(),
      type: type,
      data: data,
      kiosk: {
        id: this.config.client_id,
        name: this.config.name || 'Unknown'
      }
    };

    return this.publish(this.config.topics.interaction_topic, message);
  }

  publishStatus(status) {
    if (!this.config?.topics?.status_topic) {
      console.warn('Status topic not configured');
      return false;
    }

    const message = {
      timestamp: new Date().toISOString(),
      status: status,
      kiosk: {
        id: this.config.client_id,
        name: this.config.name || 'Unknown'
      }
    };

    return this.publish(this.config.topics.status_topic, message);
  }

  disconnect() {
    if (this.client) {
      this.publishStatus('disconnected');
      this.client.end();
      this.isConnected = false;
      console.log('MQTT client disconnected');
    }
  }

  isMQTTEnabled() {
    return this.config && this.config.aktiviert && this.isConnected;
  }
}

// Create a singleton instance
export const mqttClient = new MQTTClient();
export default mqttClient;
