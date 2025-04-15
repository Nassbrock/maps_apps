import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Property } from '../types/property';
import styled from 'styled-components/native';

interface PropertyListProps {
  properties: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
}

const PropertyCard = styled.View<{ isSelected: boolean }>`
  background-color: ${props => props.isSelected ? '#e3f2fd' : 'white'};
  border-radius: 8px;
  padding: 16px;
  margin: 8px;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
  elevation: 5;
`;

const PropertyTitle = styled.Text`
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
`;

const PropertyAddress = styled.Text`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const PropertyInfo = styled.Text`
  font-size: 16px;
  color: #333;
`;

export default function PropertyList({ properties, selectedProperty, onSelectProperty }: PropertyListProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {properties.map((property) => (
          <TouchableOpacity
            key={property.id}
            onPress={() => onSelectProperty(property)}
          >
            <PropertyCard isSelected={selectedProperty?.id === property.id}>
              <PropertyTitle>{property.title}</PropertyTitle>
              <PropertyAddress>{property.address}</PropertyAddress>
              <PropertyInfo>{property.rooms} Rooms</PropertyInfo>
              {property.price && (
                <PropertyInfo>€{property.price.toLocaleString()}</PropertyInfo>
              )}
            </PropertyCard>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingVertical: 16,
  },
}); 