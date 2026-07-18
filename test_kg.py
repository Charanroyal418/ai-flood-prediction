import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.kg.builder import kg_builder

def test_kg():
    print("Initial nodes:", len(kg_builder.graph.nodes))
    
    try:
        kg_builder.create_district_node("Madurai", 1500000, 45.2)
        print("Successfully created district node!")
    except Exception as e:
        print("Error creating district node:", type(e).__name__, e)

    try:
        kg_builder.create_river_node("Vaigai", 3.2, 500)
        print("Successfully created river node!")
    except Exception as e:
        print("Error creating river node:", type(e).__name__, e)
        
    try:
        kg_builder.link_river_to_district("Vaigai", "Madurai", 5.0)
        print("Successfully linked nodes!")
    except Exception as e:
        print("Error linking nodes:", type(e).__name__, e)
        
    try:
        kg_builder.update_node_data("Madurai", {"rainfall_24h": 60.0})
        print("Successfully updated node!")
    except Exception as e:
        print("Error updating node:", type(e).__name__, e)

if __name__ == "__main__":
    test_kg()
