from NeuroPy.NeuroPy import NeuroPy  # explicitly import the class

object1 = NeuroPy("COM3")
object1.start()

import time
time.sleep(5)
print("Attention:", object1.attention)
print("Meditation:", object1.meditation)

object1.stop()
